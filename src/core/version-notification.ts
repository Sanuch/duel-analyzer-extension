/**
 * Version notification manager with dismissed version tracking
 */

export interface VersionUpdateInfo {
  current: string;
  latest: string;
  updateUrl?: string;
}

class VersionNotificationManager {
  private storageKey = 'duel_analyzer_dismissed_versions';
  private notificationId = 'duel-analyzer-update-notification';

  /**
   * Проверяет, был ли уже закрыт баннер для этой версии
   */
  isDismissed(version: string): boolean {
    try {
      const dismissed = localStorage.getItem(this.storageKey);
      if (!dismissed) return false;
      const dismissedVersions = JSON.parse(dismissed) as string[];
      return dismissedVersions.includes(version);
    } catch {
      return false;
    }
  }

  /**
   * Добавляет версию в список отклонённых
   */
  markAsDismissed(version: string): void {
    try {
      const dismissed = localStorage.getItem(this.storageKey);
      const dismissedVersions: string[] = dismissed ? JSON.parse(dismissed) : [];
      if (!dismissedVersions.includes(version)) {
        dismissedVersions.push(version);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(dismissedVersions));
    } catch (error) {
      console.warn('[duel-analyzer] failed to save dismissed version:', error);
    }
  }

  /**
   * Показывает баннер обновления на странице
   */
  showUpdateBanner(info: VersionUpdateInfo): void {
    // Удаляем старый баннер если существует
    const existing = document.getElementById(this.notificationId);
    if (existing) {
      existing.remove();
    }

    const banner = document.createElement('div');
    banner.id = this.notificationId;
    banner.style.cssText = [
      'position:fixed',
      'top:10px',
      'right:10px',
      'z-index:999999',
      'background:#2c3e50',
      'color:#ecf0f1',
      'padding:16px 20px',
      'border-radius:6px',
      'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
      'font-family:system-ui, -apple-system, sans-serif',
      'font-size:14px',
      'max-width:320px',
      'line-height:1.4',
    ].join(';');

    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'margin-bottom:12px;';
    messageDiv.innerHTML = `
      <strong style="color:#3498db;">Доступно обновление плагина</strong><br>
      Текущая версия: ${info.current}<br>
      Новая версия: <span style="color:#2ecc71;">${info.latest}</span>
    `;

    const buttonsDiv = document.createElement('div');
    buttonsDiv.style.cssText = 'display:flex;gap:8px;';

    const updateBtn = document.createElement('button');
    updateBtn.textContent = 'Обновить';
    updateBtn.style.cssText = [
      'flex:1',
      'padding:6px 12px',
      'background:#3498db',
      'color:white',
      'border:none',
      'border-radius:4px',
      'cursor:pointer',
      'font-size:13px',
      'font-weight:500',
    ].join(';');
    updateBtn.onmouseover = () => updateBtn.style.background = '#2980b9';
    updateBtn.onmouseout = () => updateBtn.style.background = '#3498db';
    updateBtn.onclick = () => {
      if (info.updateUrl) {
        window.open(info.updateUrl, '_blank');
      }
      this.dismissNotification(banner, info.latest);
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = [
      'padding:6px 10px',
      'background:transparent',
      'color:#95a5a6',
      'border:1px solid #95a5a6',
      'border-radius:4px',
      'cursor:pointer',
      'font-size:14px',
    ].join(';');
    closeBtn.onmouseover = () => {
      closeBtn.style.color = '#ecf0f1';
      closeBtn.style.borderColor = '#ecf0f1';
    };
    closeBtn.onmouseout = () => {
      closeBtn.style.color = '#95a5a6';
      closeBtn.style.borderColor = '#95a5a6';
    };
    closeBtn.onclick = () => {
      this.dismissNotification(banner, info.latest);
    };

    buttonsDiv.appendChild(updateBtn);
    buttonsDiv.appendChild(closeBtn);

    banner.appendChild(messageDiv);
    banner.appendChild(buttonsDiv);

    document.body.appendChild(banner);

    // Автоматически скрыть через 30 секунд
    setTimeout(() => {
      if (banner.parentNode) {
        this.dismissNotification(banner, info.latest);
      }
    }, 30000);
  }

  /**
   * Закрывает уведомление и отмечает версию как отклонённую
   */
  private dismissNotification(element: HTMLElement, version: string): void {
    element.style.transition = 'opacity 0.3s ease-out';
    element.style.opacity = '0';
    setTimeout(() => {
      if (element.parentNode) {
        element.remove();
      }
    }, 300);
    this.markAsDismissed(version);
  }

  /**
   * Очищает список отклонённых версий (для тестирования)
   */
  clearDismissed(): void {
    localStorage.removeItem(this.storageKey);
  }
}

export const versionNotificationManager = new VersionNotificationManager();
