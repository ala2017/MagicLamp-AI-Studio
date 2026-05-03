import React from 'react';
import {
    Activity,
    ShoppingCart,
    Wrench,
    Settings,
    Workflow
} from 'lucide-react';

interface NavItemProps {
    id: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: (id: string) => void;
}

const NavItem: React.FC<NavItemProps> = ({ id, icon, active, onClick }) => (
    <div
        onClick={() => onClick(id)}
        style={{
            padding: 12,
            cursor: 'pointer',
            borderLeft: active ? '3px solid var(--vscode-activityBar-activeBorder)' : '3px solid transparent',
            color: active ? 'var(--vscode-activityBar-foreground)' : 'var(--vscode-activityBar-inactiveForeground)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }}
        title={id}
    >
        {icon}
    </div>
);

interface NavRailProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const NavRail: React.FC<NavRailProps> = ({ activeTab, onTabChange }) => {
    return (
        <div style={{
            width: 50,
            height: '100%',
            background: 'var(--vscode-activityBar-background)',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--vscode-activityBar-border)'
        }}>
            <NavItem id="console" icon={<Activity size={24} />} active={activeTab === 'console'} onClick={onTabChange} />
            <NavItem id="marketplace" icon={<ShoppingCart size={24} />} active={activeTab === 'marketplace'} onClick={onTabChange} />
            <NavItem id="workshop" icon={<Wrench size={24} />} active={activeTab === 'workshop'} onClick={onTabChange} />
            <NavItem id="orchestration" icon={<Workflow size={24} />} active={activeTab === 'orchestration'} onClick={onTabChange} />
            <div style={{ flex: 1 }} />
            <NavItem id="settings" icon={<Settings size={24} />} active={activeTab === 'settings'} onClick={onTabChange} />
        </div>
    );
};
