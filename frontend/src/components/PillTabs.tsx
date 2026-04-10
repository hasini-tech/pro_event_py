"use client";

import React from "react";

type Pill = { id: string; label: string };

type Props = {
  pills: Pill[];
  activeId: string;
  onChange: (id: string) => void;
};

export default function PillTabs({ pills, activeId, onChange }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        marginTop: "12px",
      }}
    >
      {pills.map((pill) => {
        const active = pill.id === activeId;
        return (
          <button
            key={pill.id}
            onClick={() => onChange(pill.id)}
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              border: active ? "2px solid #0f9d7a" : "1px solid #e5e7eb",
              background: active ? "rgba(15,157,122,0.1)" : "#fff",
              fontWeight: 800,
              color: active ? "#0f172a" : "#0f172a",
              boxShadow: "0 10px 24px rgba(0,0,0,0.04)",
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
