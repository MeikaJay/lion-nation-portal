import { useState } from "react";
import AdminIncentives from "./AdminIncentives";
import AdminIncentiveGroups from "./AdminIncentiveGroups";
import AdminBulkIncentiveAssign from "./AdminBulkIncentiveAssign";

const tabs = [
  { id: "incentives", label: "Incentive Editor" },
  { id: "groups", label: "Groups & Tiers" },
  { id: "bulk", label: "Bulk Assign Agents" },
];

export default function AdminIncentivesWorkspace() {
  const [section, setSection] = useState("incentives");
  const [version, setVersion] = useState(0);

  function switchSection(next) {
    if (next === section) return;
    setSection(next);
    setVersion(current => current + 1);
  }

  return <section style={{ width: "100%" }}>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
      {tabs.map(tab => <button key={tab.id} type="button" onClick={() => switchSection(tab.id)} style={{ padding: "13px 20px", borderRadius: 10, border: "1px solid #d9c89e", background: section === tab.id ? "#191919" : "#fffdf8", color: section === tab.id ? "#edc66d" : "#292929", fontWeight: 800, cursor: "pointer" }}>{tab.label}</button>)}
    </div>
    {section === "incentives" && <AdminIncentives key={version} />}
    {section === "groups" && <AdminIncentiveGroups key={version} />}
    {section === "bulk" && <AdminBulkIncentiveAssign key={version} />}
  </section>;
}
