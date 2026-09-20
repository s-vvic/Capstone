import "./Toggle.css";

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />

      <span className="toggle-slider" />
    </label>
  );
}

export default Toggle;