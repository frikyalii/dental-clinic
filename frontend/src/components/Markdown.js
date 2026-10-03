import ReactMarkdown from 'react-markdown';

// Renders AI text (Markdown: **bold**, - bullets, headings) as formatted HTML
export default function Markdown({ children }) {
  return <div className="md"><ReactMarkdown>{children || ''}</ReactMarkdown></div>;
}
