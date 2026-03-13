import { ChartIcon, UserIcon } from "./Icons";

type BottomBarProps = {
  onAdd: () => void;
  onStats: () => void;
  onProfile: () => void;
  disabled?: boolean;
};

export function BottomBar({ onAdd, onStats, onProfile, disabled = false }: BottomBarProps) {
  return (
    <div className="bottom-bar">
      <button className="add-btn" onClick={onAdd} disabled={disabled}>
        <span className="plus">+</span> New habit
      </button>
      <div className="bottom-actions">
        <button className="icon-btn" onClick={onStats} title="History and stats" disabled={disabled}>
          <ChartIcon className="toolbar-icon" />
        </button>
        <button className="icon-btn" onClick={onProfile} title="Profile" disabled={disabled}>
          <UserIcon className="toolbar-icon" />
        </button>
      </div>
    </div>
  );
}
