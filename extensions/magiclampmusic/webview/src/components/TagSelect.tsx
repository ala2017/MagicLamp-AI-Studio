import React from 'react';

interface TagSelectProps {
    label: string;
    options: string[];
    selected: string[];
    onToggle: (tag: string) => void;
}

export const TagSelect = ({ label, options, selected, onToggle }: TagSelectProps) => (
    <div className="space-y-2">
        <label className="text-xs font-medium text-textMuted">{label}</label>
        <div className="flex flex-wrap gap-2">
            {options.map(tag => (
                <button
                    key={tag}
                    onClick={() => onToggle(tag)}
                    className={`px-3 py-1 rounded text-[10px] border transition-all ${selected.includes(tag)
                        ? 'bg-primary/20 border-primary/50 text-white'
                        : 'bg-surfaceHighlight border-white/5 text-textMuted hover:border-white/20'
                        }`}
                >
                    {tag}
                </button>
            ))}
        </div>
    </div>
);
