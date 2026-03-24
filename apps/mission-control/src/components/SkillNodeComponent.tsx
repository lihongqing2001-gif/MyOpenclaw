import React from 'react';
import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { motion } from 'motion/react';
import { SkillNode } from '../types';
import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Hexagon, ChevronRight, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';

export type SkillNodeType = Node<Record<string, unknown> & SkillNode & { isExpanded?: boolean }>;

export const SkillNodeComponent = ({ data, selected }: NodeProps<SkillNodeType>) => {
  const { t } = useI18n();
  const { level, label, subtitle, childCount, status, isExpanded } = data;

  const isLevel1 = level === 1;
  const isLevel2 = level === 2;
  const isLevel3 = level === 3;
  const isExpandable = isLevel1 || isLevel2;

  const statusStyles = {
    idle: {
      background: 'var(--node-idle-bg)',
      borderColor: 'var(--node-idle-border)',
      color: 'var(--node-idle-text)',
    },
    running: {
      background: 'var(--node-run-bg)',
      borderColor: 'var(--node-run-border)',
      color: 'var(--node-run-text)',
    },
    error: {
      background: 'var(--node-err-bg)',
      borderColor: 'var(--node-err-border)',
      color: 'var(--node-err-text)',
    },
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={statusStyles[status]}
      className={clsx(
        'relative flex items-center rounded-xl border transition-all duration-200 hover:shadow-sm',
        'focus-within:ring-2 focus-within:ring-[var(--node-run-edge)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--bg-primary)]',
        selected ? 'ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-primary)]' : '',
        isLevel1 ? 'w-64 min-h-[4rem] px-4 py-3 cursor-pointer' : '',
        isLevel2 ? 'w-56 min-h-[3.5rem] px-3 py-2.5 cursor-pointer' : '',
        isLevel3 ? 'w-64 min-h-[4rem] px-4 py-3 cursor-pointer' : ''
      )}
      data-text={label}
    >
      {/* Handles for edges */}
      <Handle type="target" position={Position.Left} className="w-1.5 h-1.5 !bg-[var(--text-secondary)] border-none" />
      <Handle type="source" position={Position.Right} className="w-1.5 h-1.5 !bg-[var(--text-secondary)] border-none" />

      {/* Node Content */}
      <div className="flex items-center gap-3 w-full">
        {/* Icon Wrapper */}
        <div className="flex items-center justify-center w-6 h-6 rounded-md shrink-0" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
          <Hexagon className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
        </div>
        
        {/* Text Content */}
        <div className="flex flex-col flex-1 min-w-0">
          <span className={clsx(
            "text-wrap-safe break-words font-medium truncate",
            isLevel1 ? "text-sm" : "text-xs"
          )} style={{ color: 'var(--text-primary)' }}>
            {label}
          </span>
          {(subtitle || isLevel1 || isLevel2) && (
            <span className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
              {subtitle || (isLevel1 ? t('node.level1') : t('node.level2'))}
            </span>
          )}
        </div>

        {/* Right Side Actions/Status */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {status === 'running' && (
            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--node-run-edge)' }} />
          )}
          {status === 'error' && (
            <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--node-err-text)' }} />
          )}
          {status === 'idle' && isLevel3 && (
            <CheckCircle2 className="w-3.5 h-3.5 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          )}
          
          {typeof childCount === 'number' && !isLevel3 && (
            <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
              {childCount}
            </span>
          )}

          {/* Expand/Collapse Toggle */}
          {isExpandable && (
            <button
              type="button"
              data-expand-toggle="true"
              aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
              className="flex items-center justify-center w-5 h-5 rounded-full border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              <motion.div
                initial={false}
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronRight className="w-3 h-3" />
              </motion.div>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
