import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { 
  ZoomIn, ZoomOut, RotateCcw, Copy, Check, GitFork, AlertCircle, 
  Code, Eye, Palette, ChevronDown 
} from 'lucide-react';

export type MermaidThemeOption = 'auto' | 'forest' | 'neutral' | 'base' | 'default' | 'dark';

interface MermaidDiagramProps {
  code: string;
  title?: string;
  description?: string;
  type?: string;
  theme: 'light' | 'dark';
}

const THEME_OPTIONS: { id: MermaidThemeOption; label: string; description: string; colorBadge: string }[] = [
  { id: 'auto', label: 'Auto (App)', description: 'Matches current light/dark app theme', colorBadge: 'bg-blue-500' },
  { id: 'forest', label: 'Forest', description: 'Fresh green & organic palette', colorBadge: 'bg-emerald-600' },
  { id: 'neutral', label: 'Neutral', description: 'Subtle gray & minimalist look', colorBadge: 'bg-stone-500' },
  { id: 'base', label: 'Base', description: 'Clean slate & high contrast', colorBadge: 'bg-indigo-500' },
  { id: 'default', label: 'Classic', description: 'Standard colorful Mermaid palette', colorBadge: 'bg-amber-500' },
  { id: 'dark', label: 'Dark Mode', description: 'Dark high-contrast theme', colorBadge: 'bg-gray-800' },
];

export function MermaidDiagram({ code, title, description, type, theme }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const [showRawCode, setShowRawCode] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<MermaidThemeOption>(() => {
    try {
      const saved = localStorage.getItem('studysnap_mermaid_theme') as MermaidThemeOption;
      if (saved && THEME_OPTIONS.some(t => t.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'auto';
  });

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTheme = (newTheme: MermaidThemeOption) => {
    setSelectedTheme(newTheme);
    setIsThemeMenuOpen(false);
    try {
      localStorage.setItem('studysnap_mermaid_theme', newTheme);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      if (!code || !code.trim()) return;

      try {
        setError(null);

        // Determine actual mermaid theme
        let mermaidTheme: string;
        let themeVariables: Record<string, string> | undefined = undefined;

        if (selectedTheme === 'auto') {
          mermaidTheme = theme === 'dark' ? 'dark' : 'default';
          themeVariables = {
            fontFamily: 'inherit',
            primaryColor: theme === 'dark' ? '#3b82f6' : '#2563eb',
            primaryTextColor: theme === 'dark' ? '#f3f4f6' : '#ffffff',
            primaryBorderColor: theme === 'dark' ? '#60a5fa' : '#1d4ed8',
            lineColor: theme === 'dark' ? '#9ca3af' : '#4b5563',
            secondaryColor: theme === 'dark' ? '#1f2937' : '#f0fdf4',
            tertiaryColor: theme === 'dark' ? '#111827' : '#f8fafc',
          };
        } else {
          mermaidTheme = selectedTheme;
        }

        mermaid.initialize({
          startOnLoad: false,
          theme: mermaidTheme as any,
          securityLevel: 'loose',
          fontFamily: 'inherit',
          ...(themeVariables ? { themeVariables } : {}),
        });

        // Clean code (e.g. remove markdown codeblocks if accidentally included)
        let cleanedCode = code.trim();
        if (cleanedCode.startsWith('```mermaid')) {
          cleanedCode = cleanedCode.replace(/^```mermaid\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedCode.startsWith('```')) {
          cleanedCode = cleanedCode.replace(/^```\w*\s*/, '').replace(/\s*```$/, '');
        }

        const id = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, cleanedCode);
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        if (isMounted) {
          setError(err?.message || 'Unable to render visual diagram.');
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [code, theme, selectedTheme]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.6));
  const handleResetZoom = () => setZoom(1);

  const activeThemeConfig = THEME_OPTIONS.find(t => t.id === selectedTheme) || THEME_OPTIONS[0];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
              {title || 'Concept Diagram & Flow'}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {type && (
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  {type}
                </span>
              )}
              <span className="text-[10px] text-gray-400 dark:text-gray-500">•</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${activeThemeConfig.colorBadge}`} />
                {activeThemeConfig.label} Theme
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
          {/* Theme Dropdown Toggle */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
              title="Change diagram theme"
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
            >
              <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden xs:inline">Theme:</span>
              <span className="font-bold">{activeThemeConfig.label}</span>
              <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isThemeMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-800 p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Mermaid Theme Styles
                </div>
                <div className="space-y-0.5">
                  {THEME_OPTIONS.map((opt) => {
                    const isSelected = opt.id === selectedTheme;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectTheme(opt.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${opt.colorBadge} shrink-0`} />
                          <div>
                            <div className="leading-snug">{opt.label}</div>
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">
                              {opt.description}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-1.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5 hidden xs:block" />

          {/* Diagram / Code Toggle */}
          <button
            onClick={() => setShowRawCode(!showRawCode)}
            title={showRawCode ? "View visual diagram" : "View diagram code"}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
          >
            {showRawCode ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
            <span>{showRawCode ? 'Diagram' : 'Code'}</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
            <button
              onClick={handleZoomOut}
              title="Zoom out"
              className="p-1 rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              title="Reset zoom"
              className="px-1.5 py-0.5 text-[11px] font-bold rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              title="Zoom in"
              className="p-1 rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleCopyCode}
            title="Copy diagram definition"
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-4 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/30">
          {description}
        </p>
      )}

      {/* Quick Theme Preset Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar mb-3 pb-1">
        <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 shrink-0">Style:</span>
        {THEME_OPTIONS.map((opt) => {
          const isActive = opt.id === selectedTheme;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelectTheme(opt.id)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-2xs'
                  : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/80 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${opt.colorBadge}`} />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Main Diagram Render View */}
      {showRawCode ? (
        <div className="bg-gray-900 text-gray-100 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-gray-800">
          <pre>{code}</pre>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 text-xs sm:text-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Diagram Text Format:</span>
          </div>
          <pre className="bg-white/60 dark:bg-black/40 p-3 rounded-lg font-mono text-xs overflow-x-auto text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {code}
          </pre>
        </div>
      ) : svgContent ? (
        <div 
          ref={containerRef}
          className="relative min-h-[220px] max-h-[520px] overflow-auto rounded-xl bg-gray-50/70 dark:bg-gray-950/50 border border-gray-100 dark:border-gray-800/80 p-4 flex items-center justify-center transition-all"
        >
          <div 
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease-out' }}
            className="w-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center text-gray-400 text-xs sm:text-sm">
          Generating visual diagram...
        </div>
      )}
    </div>
  );
}

