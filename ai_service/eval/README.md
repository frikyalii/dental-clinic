# RAG evaluation

Measures whether the right documents are found and whether answers are correct, grounded and safe.

```bash
cd ai_service
python eval/run_eval.py --offline               # no API calls: hashed embeddings, retrieval only (fast, good for CI)
python eval/run_eval.py                         # retrieval with the real embedding model (needs HF_TOKEN)
python eval/run_eval.py --compare-rerank        # same questions WITHOUT vs WITH the reranker
python eval/run_eval.py --mode full             # also runs agentic RAG and checks the answers (uses model quota)
python eval/run_eval.py --fresh                 # re-index the sample documents from scratch
```

It indexes `eval/sample_docs` into its own folder (`eval/.data`) so your real documents are never touched, and writes `eval/report.json`.
The two scanned/photo samples are only indexed when `OCR_BACKEND` is on; their cases are skipped otherwise.

**Retrieval metrics:** Hit@k (an expected document is in the top k), MRR (how high the first expected document ranks), Recall@k (share of
expected documents found - matters for questions that need two documents), page-hit (the right page of a PDF), **leaks** (a search returned
another patient's document - must be 0).

**Answer checks (`--mode full`):** required facts present, forbidden facts absent (e.g. another patient's HbA1c), declines when the answer is not in
the documents, cites an expected document, and the verifier marked it grounded.

**Extend it:** add cases to `dataset.json` (`question`, `patient`, `expect_docs`, optional `expect_pages`, `answer_must_include` as groups of
alternatives, `answer_must_not_include`, `should_decline`). 18 cases over 9 tiny documents is a smoke test: scores near 100% mainly show nothing is
broken. Add your own real (anonymised) questions and documents for numbers you can trust, and re-run after every change to prompts, chunking or models.
