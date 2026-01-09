// // // src/components/SecurityQuestionModal.jsx
// import React, { useState, useEffect } from "react";

// export default function SecurityQuestionModal({ question, onAnswer, onTimeout, timeoutSec = 15 }) {
//   const [answer, setAnswer] = useState("");
//   useEffect(() => {
//     const t = setTimeout(() => {
//       onTimeout?.();
//     }, timeoutSec * 1000);
//     return () => clearTimeout(t);
//   }, [onTimeout, timeoutSec]);

//   return (
//     <div className="sq-modal">
//       <div className="sq-card">
//         <h3>Security Check</h3>
//         <p style={{ marginBottom: 8 }}>{question.question}</p>
//         <input value={answer} onChange={(e)=> setAnswer(e.target.value)} placeholder="Type your answer" />
//         <div style={{ marginTop: 12 }}>
//           <button className="primary" onClick={() => onAnswer(answer)}>Submit</button>
//         </div>
//         <small style={{ display: "block", marginTop: 8, color: "#666" }}>Auto-fails in {timeoutSec}s</small>
//       </div>
//     </div>
//   );
// }
// src/components/SecurityQuestionModal.jsx
import React, { useEffect, useState } from "react";

export default function SecurityQuestionModal({ question, onAnswer, onTimeout, timeoutSec = 15 }) {
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      onTimeout?.();
    }, timeoutSec * 1000);
    return () => clearTimeout(id);
  }, [onTimeout, timeoutSec]);

  return (
    <div className="sq-modal">
      <div className="sq-card">
        <h3 style={{ marginTop: 0 }}>Security Check</h3>
        <p style={{ minHeight: 36 }}>{question.question}</p>
        <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer" />
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
          <button className="primary" onClick={() => onAnswer(answer)}>Submit</button>
        </div>
        <small style={{ color: "#666", marginTop: 8, display: "block" }}>Auto-fails in {timeoutSec}s</small>
      </div>
    </div>
  );
}
