/**
 * Markdown.tsx
 * Used to render markdown content in the chat.
 * @AshokSaravanan222
 * 05/15/2025
 */

import "katex/dist/katex.min.css"; // Keep KaTeX CSS
import ReactMarkdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import RehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import RemarkMathPlugin from "remark-math";
// remarkDirective might not be needed if no custom directives are used in the barebones version
// import remarkDirective from 'remark-directive';
import "highlight.js/styles/github.css"; // Keep highlight.js CSS for code blocks
import rehypeHighlight from "rehype-highlight";
import MarkdownImage from "@/client/components/chat/MarkdownImage";
// Removed Avatar, Badge, Flex, Text from '@mantine/core' as they are not used
// Removed imports related to data fetching and specific types like Document, CONTENT_COLORS
// Removed IconChevronRight
// Removed Image from 'next/image' unless MarkdownImage specifically needs it and handles it

interface MarkdownProps {
  children: string;
}

export default function Markdown({ children }: MarkdownProps) {
  // Removed supabase and useQuery hooks for user, profile, files, fileDocuments

  // Removed getDocumentLabel and renderBadges functions

  // Simplified text processing: only keep newline handling for <br> tags
  const processedText = children.replace(/\n/g, "  \n");

  return (
    <div className="latex-container">
      {" "}
      {/* Consider renaming this class if it's no longer just for "Latex" */}
      <ReactMarkdown
        remarkPlugins={[
          RemarkMathPlugin,
          remarkGfm,
          // remarkDirective, // Only include if you plan to use custom directives
        ]}
        rehypePlugins={[
          RehypeKatex,
          rehypeRaw,
          rehypeSlug,
          rehypeAutolinkHeadings,
          [rehypeHighlight, { ignoreMissing: true }],
        ]}
        components={{
          p: ({ children }) => <p className="prose-p">{children}</p>,
          h1: ({ children }) => <h1 className="prose-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="prose-h2">{children}</h2>,
          // ... other prose elements from your original component
          h3: ({ children }) => <h3 className="prose-h3">{children}</h3>, // Added for completeness
          h4: ({ children }) => <h4 className="prose-h4">{children}</h4>, // Added for completeness
          a: ({ children, href, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="prose-blockquote">{children}</blockquote>
          ),
          ul: ({ children }) => <ul className="prose-ul">{children}</ul>,
          ol: ({ children }) => <ol className="prose-ol">{children}</ol>,
          li: ({ children }) => <li className="prose-li">{children}</li>,
          table: ({ children }) => (
            <table className="prose-table">{children}</table>
          ),
          thead: ({ children }) => (
            <thead className="prose-thead">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="prose-tbody">{children}</tbody>
          ),
          tr: ({ children }) => <tr className="prose-tr">{children}</tr>,
          th: ({ children }) => <th className="prose-th">{children}</th>,
          td: ({ children }) => <td className="prose-td">{children}</td>,
          pre: ({ children }) => (
            <pre className="prose-pre not-prose">{children}</pre>
          ), // Apply not-prose to pre for custom highlight.js styling
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            return match ? (
              // For highlighted code blocks, rehypeHighlight will handle it.
              // The `pre` tag above will wrap this.
              // We add `not-prose` to `pre` so Tailwind typography doesn't override highlight.js
              <code className={className} {...props}>
                {children}
              </code>
            ) : (
              // For inline code
              <code className="prose-code" {...props}>
                {children}
              </code>
            );
          },
          img: ({ src, alt }) => (
            <MarkdownImage src={src as string} alt={alt as string} />
          ),
          // Removed custom span component logic for 'tag-badge'
        }}
      >
        {processedText}
      </ReactMarkdown>
      <style jsx global>{`
        .latex-container {
          /* Consider renaming to .markdown-container or similar */
          font-size: 1rem;
          line-height: 1.75;
          width: 100%; /* Ensure container takes full width of parent */
          max-width: 100%; /* Prevent overflow */
          overflow-wrap: break-word; /* Allow long words to break */
          word-wrap: break-word; /* Legacy support */
          word-break: break-word; /* Less aggressive than break-all */
        }

        .prose-p {
          margin: 1.25em 0;
        }

        .latex-container > :first-child {
          margin-top: 0;
        }

        .latex-container > :last-child {
          margin-bottom: 0;
        }

        .prose-h1 {
          margin: 1em 0 0.5em; /* Adjusted for typical heading spacing */
          font-size: 2.25em; /* Tailwind text-4xl */
          font-weight: 700;
          line-height: 1.2;
        }

        .prose-h2 {
          margin: 1.5em 0 0.75em;
          font-size: 1.875em; /* Tailwind text-3xl */
          font-weight: 700;
          line-height: 1.25;
        }

        .prose-h3 {
          margin: 1.5em 0 0.75em;
          font-size: 1.5em; /* Tailwind text-2xl */
          font-weight: 600;
          line-height: 1.33;
        }

        .prose-h4 {
          margin: 1.5em 0 0.75em;
          font-size: 1.25em; /* Tailwind text-xl */
          font-weight: 600;
          line-height: 1.33;
        }

        .prose-a {
          color: #2563eb; /* Example blue, align with your theme */
          text-decoration: underline;
        }
        .prose-a:hover {
          color: #1d4ed8;
        }

        .prose-blockquote {
          margin: 1.5em 0;
          padding-left: 1em;
          border-left: 0.25em solid #e5e7eb; /* Example border, align with theme */
          font-style: italic;
        }

        /* Add styles for prose-code (inline code) */
        .prose-code {
          background-color: #f3f4f6; /* Light gray background */
          padding: 0.2em 0.4em;
          margin: 0;
          font-size: 85%;
          border-radius: 3px;
          /* Ensure this matches your Tailwind typography settings for inline code */
        }

        /* Styling for code blocks (pre > code) will be handled by highlight.js theme */
        /* Ensure .prose-pre or pre within .latex-container is styled appropriately if not using not-prose */
        .prose-pre {
          margin: 1.5em 0;
          padding: 1em;
          overflow-x: auto;
          border-radius: 0.375rem; /* Tailwind rounded-md */
          max-width: 100%; /* Ensure code blocks don't overflow */
          white-space: pre-wrap; /* Allow code to wrap */
        }

        /* Ensure inline elements don't overflow */
        .prose-code,
        .prose-a {
          word-break: break-word;
          overflow-wrap: break-word;
        }

        .prose-ul,
        .prose-ol {
          margin: 1.25em 0;
          padding-left: 1.625em;
        }

        .prose-li {
          margin: 0.5em 0;
          padding-left: 0.375em;
        }

        .katex-display {
          margin: 1em 0 !important;
          overflow-x: auto;
          overflow-y: hidden;
          max-width: 100%; /* Ensure math doesn't overflow */
        }

        .katex {
          text-rendering: auto;
        }

        /* Table styles */
        .prose-table {
          width: auto; /* Let table size itself, or max-width: 100% for responsive */
          margin: 1.5em auto;
          border-collapse: collapse;
          overflow-x: auto; /* Important for wide tables */
          display: block; /* For overflow-x to work well */
          max-width: 100%;
        }

        /* Removed .prose-table table {} as .prose-table is the table itself */

        .prose-th {
          padding: 0.5em 1em; /* Tailwind-like padding */
          border: 1px solid #e5e7eb; /* Tailwind gray-200 */
          font-weight: 600;
          text-align: left;
          background-color: #f9fafb; /* Tailwind gray-50 */
        }

        /* Dark mode example for th (you'd use Tailwind dark: classes in practice) */
        /* @media (prefers-color-scheme: dark) {
                    .prose-th {
                        background-color: #374151; // gray-700
                        border-color: #4b5563; // gray-600
                    }
                } */

        .prose-td {
          padding: 0.5em 1em;
          border: 1px solid #e5e7eb; /* Tailwind gray-200 */
          vertical-align: top;
        }
        /* Dark mode example for td */
        /* @media (prefers-color-scheme: dark) {
                    .prose-td {
                        border-color: #4b5563; // gray-600
                    }
                } */

        .prose-table tr:nth-child(even) {
          background-color: #f9fafb; /* Tailwind gray-50 for light mode */
        }
        /* Dark mode example for even rows */
        /* @media (prefers-color-scheme: dark) {
                    .prose-table tr:nth-child(even) {
                        background-color: #1f2937; // gray-800
                    }
                } */

        /* Removed badge alignment and context-reference-link styles */

        /* Add improved handling for LaTeX content */
        .katex {
          text-rendering: auto;
          white-space: nowrap !important; /* This can be aggressive, test it */
        }

        span.math.math-inline {
          white-space: nowrap;
          display: inline-block; /* Or inline-flex for better alignment */
          vertical-align: middle; /* Adjust as needed */
        }

        .latex-container .katex-display > .katex {
          display: inline-block;
          text-align: initial;
          white-space: nowrap; /* Again, test this */
        }

        .katex .msupsub {
          text-align: left;
        }

        .math-wrapper {
          /* If you wrap math content manually */
          display: inline-block;
          white-space: nowrap;
        }

        /* Ensure highlight.js styles apply correctly */
        .hljs {
          display: block;
          overflow-x: auto;
          padding: 0.5em;
          /* background: #f8f8f8; /* Example background, theme will provide this */
          /* color: #333; /* Example text color, theme will provide this */
        }

        /* Ensure images are responsive */
        img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}
