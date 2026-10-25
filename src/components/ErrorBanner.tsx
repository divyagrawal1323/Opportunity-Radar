'use client';

import { AlertTriangle, KeyRound, Clock, ShieldAlert, WifiOff, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  code?: string;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, code, onDismiss }: ErrorBannerProps) {
  const getIcon = () => {
    if (code?.includes('401') || message.includes('API key')) {
      return <KeyRound className="w-5 h-5 text-rose-500" />;
    }
    if (code?.includes('429') || message.includes('Too many requests')) {
      return <Clock className="w-5 h-5 text-amber-500" />;
    }
    if (code?.includes('402') || message.includes('Daily free limit')) {
      return <ShieldAlert className="w-5 h-5 text-amber-500" />;
    }
    if (code?.includes('NETWORK') || message.includes('reach TinyFish')) {
      return <WifiOff className="w-5 h-5 text-rose-500" />;
    }
    return <AlertTriangle className="w-5 h-5 text-rose-500" />;
  };

  const getHelpTip = () => {
    if (code?.includes('401') || message.includes('API key')) {
      return 'Verify that TINYFISH_API_KEY and GEMINI_API_KEY are properly configured in your .env.local file.';
    }
    if (code?.includes('429') || message.includes('Too many requests')) {
      return 'The rate limit was temporarily exceeded. TinyFish allows 30 requests/min. Please wait ~30 seconds and try again.';
    }
    if (code?.includes('402') || message.includes('Daily free limit')) {
      return 'The daily free allowance on TinyFish was reached. It resets daily at 00:00 UTC or you can top up your wallet balance.';
    }
    if (code?.includes('NETWORK') || message.includes('reach TinyFish')) {
      return 'Check your internet connection or verify that api.search.tinyfish.ai is accessible from your network.';
    }
    return 'Please try adjusting your search terms or verify your server configuration.';
  };

  return (
    <div
      role="alert"
      className="w-full rounded-2xl p-4 border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white dark:bg-rose-900/40 border border-rose-200/80 dark:border-rose-800 shrink-0">
            {getIcon()}
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold tracking-tight">{message}</h4>
            <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed">
              {getHelpTip()}
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss error banner"
            className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
