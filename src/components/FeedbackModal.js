import { useState } from "react";
import { submitFeedback } from "../feedbackStorage";

const EMPTY_FEEDBACK = {
  category: "bug",
  message: "",
  email: "",
};

export default function FeedbackModal({ onClose }) {
  const [feedback, setFeedback] = useState(EMPTY_FEEDBACK);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const update = (field) => (event) => {
    setFeedback((current) => ({ ...current, [field]: event.target.value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    try {
      await submitFeedback(feedback);
      setStatus("sent");
    } catch (submissionError) {
      setStatus("idle");
      setError(submissionError.message || "Feedback could not be sent.");
    }
  };

  return (
    <div className="feedback-layer" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <button className="feedback-backdrop" onClick={onClose} aria-label="Close feedback" />
      <section className="feedback-dialog">
        <header className="feedback-header">
          <div>
            <span className="mobile-eyebrow">BETA FEEDBACK</span>
            <h2 id="feedback-title">Help improve Wheel App</h2>
          </div>
          <button className="feedback-close" onClick={onClose} aria-label="Close feedback">×</button>
        </header>

        {status === "sent" ? (
          <div className="feedback-success">
            <strong>Feedback received.</strong>
            <p>Thanks for helping shape the beta.</p>
            <button className="csp-btn" onClick={onClose}>DONE</button>
          </div>
        ) : (
          <form className="feedback-form" onSubmit={submit}>
            <label>
              <span>Feedback type</span>
              <select value={feedback.category} onChange={update("category")}>
                <option value="bug">Bug</option>
                <option value="feature_request">Feature Request</option>
                <option value="general_feedback">General Feedback</option>
              </select>
            </label>

            <label>
              <span>Message</span>
              <textarea
                value={feedback.message}
                onChange={update("message")}
                maxLength={5000}
                required
                placeholder="What happened, or what would make Wheel App better?"
              />
            </label>

            <label>
              <span>Optional email</span>
              <input
                type="email"
                value={feedback.email}
                onChange={update("email")}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>

            {error && <div className="feedback-error" role="alert">{error}</div>}

            <button className="feedback-submit" type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "SENDING…" : "SEND FEEDBACK"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
