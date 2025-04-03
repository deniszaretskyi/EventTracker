import { useState } from "react";

/**
 * A dropdown or list of existing sessions (IDs).
 * Calls onSelect when the user chooses a session.
 */
export default function SessionSelector({ sessions, onSelect }) {
  const [selectedId, setSelectedId] = useState("");

  const handleChange = (e) => {
    const val = e.target.value;
    setSelectedId(val);
    onSelect(val);
  };

  return (
    <div>
      <label htmlFor="sessionSelect">
        <strong>Select session: </strong>
      </label>
      <select id="sessionSelect" value={selectedId} onChange={handleChange}>
        <option value="">-- None --</option>
        {sessions.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </div>
  );
}
