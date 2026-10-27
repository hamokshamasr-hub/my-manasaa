import { useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';

export default function GoogleAnalytics() {
  const { settings } = useSettings();

  useEffect(() => {
    if (!settings?.gaMeasurementId) return;

    const id = settings.gaMeasurementId;
    
    // Create script 1
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.appendChild(script1);

    // Create script 2
    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${id}');
    `;
    document.head.appendChild(script2);

    return () => {
      document.head.removeChild(script1);
      document.head.removeChild(script2);
    };
  }, [settings?.gaMeasurementId]);

  return null;
}
