import { useState, useRef, useEffect } from "react";
import Linkify from "react-linkify";
import ReactMarkdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";
import remarkGfm from "remark-gfm";
import "./app.css";

/* ───── Simulated chat data ───── */
const SAMPLE_MESSAGES = [
  { role: "customer", text: "Hi, here is my ticket: https://example.com/ticket/12345" },
  { role: "agent", text: "Let me check that. Can you also open https://google.com and verify?" },
  { role: "customer", text: "Sure, also see https://github.com/aws/amazon-connect-streams for reference" },
];

/* ───── Broken path: exactly what the CCP ChatWidget does ───── */
function BrokenLinkify({ content }) {
  // This is the ACTUAL code from the CCP ChatWidget:
  // createElement(Linkify, { properties: { target: "_blank", rel: "noopener noreferrer" } }, content)
  //
  // react-linkify v1.x does NOT support "properties" — it's silently ignored.
  return (
    <Linkify properties={{ target: "_blank", rel: "noopener noreferrer" }}>
      {content}
    </Linkify>
  );
}

/* ───── Fixed path: what the CCP SHOULD do with v1.x ───── */
function FixedLinkify({ content }) {
  // react-linkify v1.x uses componentDecorator instead of properties
  return (
    <Linkify
      componentDecorator={(href, text, key) => (
        <a href={href} key={key} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      )}
    >
      {content}
    </Linkify>
  );
}

/* ───── Working path: RichMessageRenderer (text/markdown) ───── */
function MarkdownRenderer({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeExternalLinks, { target: "_blank", rel: ["noopener", "noreferrer"] }]]}
    >
      {content}
    </ReactMarkdown>
  );
}

/* ───── Chat message bubble ───── */
function ChatMessage({ role, children }) {
  return (
    <div className={`msg msg-${role}`}>
      <div className="msg-label">{role}</div>
      <div className="msg-content">{children}</div>
    </div>
  );
}

/* ───── HTML inspector: grabs actual DOM output ───── */
function useHtmlInspector(ref, deps) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!ref.current) return;
    // small delay to let react render
    const t = setTimeout(() => {
      const anchors = ref.current.querySelectorAll("a");
      if (anchors.length === 0) {
        setHtml('<span class="dim">No links detected</span>');
        return;
      }
      const parts = Array.from(anchors).map((a) => {
        const href = a.getAttribute("href") || "";
        const target = a.getAttribute("target");
        const rel = a.getAttribute("rel");
        const shortHref = href.length > 50 ? href.slice(0, 50) + "..." : href;

        let out = `<span class="hl-tag">&lt;a</span> <span class="hl-attr">href</span>=<span class="hl-val">"${shortHref}"</span>`;
        if (target) {
          out += ` <span class="hl-good"><span class="hl-attr">target</span>=<span class="hl-val">"${target}"</span></span>`;
        }
        if (rel) {
          out += ` <span class="hl-good"><span class="hl-attr">rel</span>=<span class="hl-val">"${rel}"</span></span>`;
        }
        if (!target) {
          out += ` <span class="hl-bad">← missing target="_blank"</span>`;
        }
        out += `<span class="hl-tag">&gt;</span>`;
        return out;
      });
      setHtml(parts.join("<br>"));
    }, 50);
    return () => clearTimeout(t);
  }, deps);

  return html;
}

/* ───── Demo panel with live inspection ───── */
function DemoPanel({ title, badge, badgeClass, messages, renderFn }) {
  const ref = useRef(null);
  const html = useHtmlInspector(ref, [messages]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        <span className={`badge ${badgeClass}`}>{badge}</span>
      </div>
      <div className="chat-window" ref={ref}>
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role}>
            {renderFn(msg.text)}
          </ChatMessage>
        ))}
      </div>
      <div className="inspect-panel">
        <div className="inspect-label">Rendered &lt;a&gt; tags (live from DOM)</div>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

/* ───── Main App ───── */
export default function App() {
  const [customMsg, setCustomMsg] = useState("Check this out: https://google.com");
  const [testMessages, setTestMessages] = useState(SAMPLE_MESSAGES);

  const handleSend = () => {
    if (!customMsg.trim()) return;
    setTestMessages([...testMessages, { role: "customer", text: customMsg }]);
    setCustomMsg("");
  };

  return (
    <div className="app">
      <header>
        <h1>
          CCP Chat Link <span className="accent-red">Bug</span> Demo
        </h1>
        <p className="subtitle">
          Using <strong>actual react-linkify v1.0.0-alpha</strong> to reproduce the Module Federation regression
        </p>
      </header>

      <section>
        <div className="section-label">Rendering comparison</div>
        <div className="grid-3">
          <DemoPanel
            title="text/plain → Linkify (properties)"
            badge="BROKEN"
            badgeClass="badge-broken"
            messages={testMessages}
            renderFn={(text) => <BrokenLinkify content={text} />}
          />
          <DemoPanel
            title="text/plain → Linkify (componentDecorator)"
            badge="AWS FIX"
            badgeClass="badge-amber"
            messages={testMessages}
            renderFn={(text) => <FixedLinkify content={text} />}
          />
          <DemoPanel
            title="text/markdown → ReactMarkdown"
            badge="OUR FIX"
            badgeClass="badge-working"
            messages={testMessages}
            renderFn={(text) => <MarkdownRenderer content={text} />}
          />
        </div>
      </section>

      <section>
        <div className="section-label">Add a message</div>
        <div className="send-bar">
          <input
            className="send-input"
            value={customMsg}
            onChange={(e) => setCustomMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message with a URL..."
          />
          <button className="send-btn" onClick={handleSend}>Send</button>
        </div>
      </section>

      <section>
        <div className="section-label">What the CCP ChatWidget does</div>
        <div className="grid-2">
          <div className="code-panel">
            <div className="code-header">
              <span>ChatWidget — Current (Broken)</span>
              <span className="badge badge-broken">Bug</span>
            </div>
            <pre className="code-block">{`// CCP passes "properties" prop
// react-linkify v1.x IGNORES this

<Linkify
  properties={{
    target: "_blank",
    rel: "noopener noreferrer"
  }}
>
  {message.content}
</Linkify>

// Result: <a href="...">
//         ↑ no target, no rel`}</pre>
          </div>
          <div className="code-panel">
            <div className="code-header">
              <span>ChatWidget — Correct (v1.x API)</span>
              <span className="badge badge-working">Fix</span>
            </div>
            <pre className="code-block">{`// v1.x uses componentDecorator

<Linkify
  componentDecorator={
    (href, text, key) => (
      <a
        href={href}
        key={key}
        target="_blank"
        rel="noopener noreferrer"
      >
        {text}
      </a>
    )
  }
>
  {message.content}
</Linkify>

// Result: <a href="..." target="_blank">`}</pre>
          </div>
        </div>
      </section>

      <section>
        <div className="section-label">Our workaround</div>
        <div className="code-panel" style={{ maxWidth: 720 }}>
          <div className="code-header">
            <span>Switch to text/markdown</span>
            <span className="badge badge-amber">Workaround</span>
          </div>
          <pre className="code-block">{`// 1. StartChatContact — declare markdown support
{
  "InstanceId": "...",
  "ContactFlowId": "...",
  "SupportedMessagingContentTypes": [
    "text/plain",
    "text/markdown"       // ← add this
  ]
}

// 2. SendMessage — use text/markdown
session.sendMessage({
  message: "Hello https://example.com",
  contentType: "text/markdown"  // ← change from text/plain
});

// Bypasses Linkify entirely → uses RichMessageRenderer
// Links get target="_blank" automatically`}</pre>
        </div>
      </section>
    </div>
  );
}
