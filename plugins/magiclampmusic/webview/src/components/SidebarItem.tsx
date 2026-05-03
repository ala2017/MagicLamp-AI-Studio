import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    active: boolean;
    onClick: () => void;
}

export const SidebarItem = ({ icon: Icon, label, active, onClick }: SidebarItemProps) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all relative group
        ${active
                ? 'text-white bg-white/5 border-r-2 border-primary'
                : 'text-textMuted hover:text-white hover:bg-white/5'
            }`}
    >
        <Icon
            size={18}
            className={`transition-colors ${active ? 'text-primary' : 'text-textMuted group-hover:text-white'}`}
        />
        <span>{label}</span>
        {active && (
            <div className="absolute inset-y-0 left-0 w-1 bg-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
        )}
    </button>
);
