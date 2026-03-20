import { ChartIcon, UserIcon } from "./Icons";

type BottomBarProps = {
  onAdd: () => void;
  onStats: () => void;
  onProfile: () => void;
  disableAdd?: boolean;
  disableNav?: boolean;
};

export function BottomBar({ onAdd, onStats, onProfile, disableAdd = false, disableNav = false }: BottomBarProps) {
  return (
    <div className="bottom-bar">
      <button className="add-btn" onClick={onAdd} disabled={disableAdd}>
        <span className="plus">+</span> New habit
      </button>
      <div className="bottom-actions">
        <button className="icon-btn" onClick={onStats} title="History and stats" disabled={disableNav}>
          <ChartIcon className="toolbar-icon" />
        </button>
        <button className="icon-btn" onClick={onProfile} title="Profile" disabled={disableNav}>
          <UserIcon className="toolbar-icon" />
        </button>
      </div>
    </div>
  );
}
