import { useTranslation } from 'react-i18next'

export function LanguageToggle() {
  const { i18n, t } = useTranslation()
  const current = i18n.resolvedLanguage === 'en' ? 'en' : 'ja'
  const next = current === 'ja' ? 'en' : 'ja'

  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(next)}
      className="lang-toggle"
      style={{
        marginLeft: 'auto',
        padding: '4px 10px',
        fontSize: '0.78rem',
        fontWeight: 600,
        background: 'transparent',
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: '8px',
        cursor: 'pointer',
      }}
      title={current === 'ja' ? t('language.switch_to_en') : t('language.switch_to_ja')}
    >
      {current === 'ja' ? t('language.en') : t('language.ja')}
    </button>
  )
}
