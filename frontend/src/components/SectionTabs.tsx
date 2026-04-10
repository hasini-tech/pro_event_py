"use client";

import React from "react";

type Tab = {
  id: string;
  label: string;
};

type Props = {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
};

const SectionTabs: React.FC<Props> = ({ tabs, activeId, onChange }) => {
  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        padding: "10px 0",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              border: active ? "2px solid var(--primary-color)" : "1px solid #e5e7eb",
              background: active ? "rgba(15,115,119,0.1)" : "#fff",
              fontWeight: 800,
              color: active ? "var(--primary-strong)" : "var(--text-primary)",
              boxShadow: "0 8px 18px rgba(0,0,0,0.04)",
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default SectionTabs;
