// src/components/PanicButton.jsx
import React from "react";

export default function PanicButton({ onPanic }) {
  return (
    <button className="panic-btn" onClick={() => onPanic?.()}>
      🚨 Panic
    </button>
  );
}
