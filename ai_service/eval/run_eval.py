#!/usr/bin/env python
"""RAG evaluation harness. Run from the ai_service folder:

  python eval/run_eval.py --offline                    # retrieval metrics only, no API calls (CI-friendly)
  python eval/run_eval.py                              # retrieval metrics with real embeddings (needs HF_TOKEN)
  python eval/run_eval.py --compare-rerank             # retrieval WITHOUT vs WITH the reranker, side by side
  python eval/run_eval.py --mode full                  # also run the whole agentic RAG pipeline and check the answers

It ingests eval/sample_docs into its OWN data folder (eval/.data), so your real documents and index are never touched.
Metrics: Hit@k (an expected document is in the top k), MRR (how high it ranks), Recall@k (share of expected documents found),
page-hit (the right page was retrieved), leaks (a search returned ANOTHER patient's document - must be 0), and for --mode full:
answer checks (required facts present, forbidden facts absent, declines when it should, cites the right document, verified)."""
import argparse, json, os, re, shutil, sys, time, zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
DECLINE = ("couldn't find", "could not find", "can't find", "cannot find", "not found", "no information", "don't have", "do not have", "not available")


def hash_embeddings():
    """Deterministic offline embeddings (hashed bag of words) so retrieval can be evaluated without any API."""
    from langchain_core.embeddings import Embeddings
    from app import retrieval

    class Hash(Embeddings):
        def _v(self, text):
            v = [0.0] * 256
            for t in retrieval._tokens(text):
                v[zlib.crc32(t.encode()) % 256] += 1.0
            n = sum(x * x for x in v) ** 0.5 or 1.0
            return [x / n for x in v]
        def embed_documents(self, texts): return [self._v(t) for t in texts]
        def embed_query(self, text): return self._v(text)
    return Hash()


def ingest_samples(docs, patients, offline):
    skipped = []
    folders = [(HERE / "sample_docs" / "clinic", None)]
    for d in sorted((HERE / "sample_docs" / "patients").iterdir()):
        code = d.name.split("_")[0]
        if code in patients:
            folders.append((d, patients[code]))
    added = 0
    for folder, pid in folders:
        for f in sorted(folder.iterdir()):
            try:
                docs.ingest(f.name, f.read_bytes(), pid, "Eval sample")
                added += 1
            except ValueError as e:
                if "already uploaded" not in str(e):
                    skipped.append(f"{f.name}: {str(e)[:90]}")
    return added, skipped


def eval_retrieval(docs, case, pid, k, backend):
    t = time.time()
    hits = docs.search_documents(case["question"], pid, k, rerank_backend=backend)
    out = {"id": case["id"], "latency": time.time() - t, "titles": [h["title"] for h in hits]}
    out["leak"] = any((docs.get(h["doc_id"]) or {}).get("patient_id", 0) not in (0, pid or 0) for h in hits)
    exp = case.get("expect_docs", [])
    if exp:
        rank = next((i + 1 for i, h in enumerate(hits) if h["title"] in exp), None)
        out.update(hit=rank is not None, rr=1 / rank if rank else 0.0, recall=len({h["title"] for h in hits} & set(exp)) / len(exp))
        pages = case.get("expect_pages")
        if pages:
            out["page_hit"] = any(pages.get(h["title"]) == h["page"] for h in hits)
    return out


def summarize(rows):
    scored = [r for r in rows if "hit" in r]
    pg = [r for r in rows if "page_hit" in r]
    avg = lambda xs: sum(xs) / len(xs) if xs else float("nan")
    return {"cases": len(scored), "hit@k": avg([r["hit"] for r in scored]), "mrr": avg([r["rr"] for r in scored]),
            "recall@k": avg([r["recall"] for r in scored]), "page_hit": avg([r["page_hit"] for r in pg]),
            "leaks": sum(r["leak"] for r in rows), "avg_latency_s": avg([r["latency"] for r in rows])}


def eval_full(agentic, case, pid):
    t = time.time()
    out = agentic.ask(case["question"], pid)
    ans = out["answer"].lower()
    checks = {"required_facts": all(any(o.lower() in ans for o in g) for g in case.get("answer_must_include", [])),
              "no_forbidden": not any(x.lower() in ans for x in case.get("answer_must_not_include", []))}
    if case.get("should_decline"):
        checks["declined"] = any(p in ans for p in DECLINE) or not out["citations"]
    if case.get("expect_docs"):
        checks["cited_expected_doc"] = any(c["title"] in case["expect_docs"] for c in out["citations"])
        checks["verified"] = out["grounded"]
    return {"id": case["id"], "type": case["type"], "passed": all(checks.values()), "checks": checks, "latency": time.time() - t,
            "answer": out["answer"][:300], "trace": out["trace"]}


def pct(x): return "  n/a" if x != x else f"{x*100:5.1f}%"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mode", choices=["retrieval", "full"], default="retrieval")
    ap.add_argument("--compare-rerank", action="store_true")
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--offline", action="store_true", help="hashed embeddings, no API calls (retrieval only)")
    ap.add_argument("--fresh", action="store_true", help="delete eval/.data first")
    ap.add_argument("--data-dir", default=str(HERE / ".data"))
    ap.add_argument("--out", default=str(HERE / "report.json"))
    args = ap.parse_args()
    if args.offline and (args.mode == "full" or args.compare_rerank):
        sys.exit("--offline only supports plain retrieval evaluation (reranking and answers need the model).")

    os.environ["AI_DATA_DIR"] = args.data_dir          # isolated index; must be set before the app is imported
    if args.fresh:
        shutil.rmtree(args.data_dir, ignore_errors=True)
    from app import agentic_rag, config, docs, vectorstore
    if args.offline:
        vectorstore.embeddings = lambda: hash_embeddings()
        config.OCR_BACKEND, config.RERANK_BACKEND = "none", "none"

    data = json.loads((HERE / "dataset.json").read_text())
    patients = data["patients"]
    added, skipped = ingest_samples(docs, patients, args.offline)
    print(f"Indexed {added} sample documents" + (f" ({len(skipped)} skipped)" if skipped else ""))
    for s in skipped:
        print("  skipped -", s)
    available = {d["filename"] for pid in [None, *patients.values()] for d in docs.list_documents(pid)}
    cases = [c for c in data["cases"] if all(e in available for e in c.get("expect_docs", []))]
    pid_of = lambda c: patients[c["patient"]] if c.get("patient") else None
    report = {"k": args.k, "backend": config.RERANK_BACKEND}

    backends = ["none", config.RERANK_BACKEND] if args.compare_rerank else [None]
    for b in backends:
        label = f"rerank={b or config.RERANK_BACKEND}"
        rows = [eval_retrieval(docs, c, pid_of(c), args.k, b) for c in cases]
        m = summarize(rows)
        report.setdefault("retrieval", {})[label] = {"summary": m, "rows": rows}
        print(f"\nRetrieval ({label}, k={args.k}, {m['cases']} scored cases)")
        print(f"  Hit@k {pct(m['hit@k'])} | MRR {m['mrr']:.3f} | Recall@k {pct(m['recall@k'])} | page-hit {pct(m['page_hit'])} | "
              f"leaks {m['leaks']} | avg {m['avg_latency_s']:.2f}s/query")
        for r in rows:
            if "hit" in r and (not r["hit"] or r.get("page_hit") is False or r["rr"] < 1):
                print(f"    - {r['id']}: first expected doc rank {1/r['rr']:.0f}" if r["rr"] else f"    - {r['id']}: MISS  got {r['titles']}")

    failed_isolation = sum(r["leak"] for v in report["retrieval"].values() for r in v["rows"])
    if args.mode == "full":
        results = []
        for c in cases:
            try:
                results.append(eval_full(agentic_rag, c, pid_of(c)))
            except Exception as e:
                results.append({"id": c["id"], "type": c["type"], "passed": False, "checks": {}, "error": f"{type(e).__name__}: {e}"})
        report["answers"] = results
        print(f"\nAnswers (full agentic RAG): {sum(r['passed'] for r in results)}/{len(results)} passed")
        for r in results:
            bad = [k for k, v in r["checks"].items() if not v]
            print(f"  {'PASS' if r['passed'] else 'FAIL'}  {r['id']:24s}" + (f" failed: {bad}" if bad else "") + (f" ERROR {r['error']}" if r.get("error") else ""))
        failed_isolation += sum(1 for r in results if r["type"] == "isolation" and not r["passed"])

    Path(args.out).write_text(json.dumps(report, indent=2, default=str))
    print(f"\nReport written to {args.out}")
    sys.exit(1 if failed_isolation else 0)  # any isolation failure = non-zero exit (usable in CI)


if __name__ == "__main__":
    main()
