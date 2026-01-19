'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface DropdownItem {
    label: string;
    icon?: React.ElementType;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}

interface ToolbarDropdownProps {
    label: string;
    items: DropdownItem[];
}

export default function ToolbarDropdown({ label, items }: ToolbarDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    isOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
            >
                {label}
                <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    {items.map((item, index) => (
                        <button
                            key={index}
                            disabled={item.disabled}
                            onClick={() => {
                                item.onClick();
                                setIsOpen(false);
                            }}
                            className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-left transition-colors ${
                                item.disabled ? 'opacity-40 cursor-not-allowed' : 
                                item.danger ? 'text-red-600 hover:bg-red-50' : 
                                'text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            {item.icon && <item.icon className="w-4 h-4" />}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
