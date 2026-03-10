module.exports = {
  options: {
    debug: false,
    sort: true,
    func: {
      list: ['t', 'i18next.t', 'i18n.t'],
      extensions: ['.js', '.jsx', '.ts', '.tsx']
    },
    trans: {
      component: 'Trans',
      i18nKey: 'i18nKey',
      defaultsKey: 'defaults',
      extensions: [''],
      fallbackKey: false,
      supportBasicHtmlNodes: true,
      keepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em', 'span']
    },
    lngs: ['en', 'es', 'zh'],
    fallbackLng: 'en',
    ns: ['translation'],
    defaultNs: 'translation',
    keySeparator: '.',
    nsSeparator: ':',
    pluralSeparator: '_',
    contextSeparator: '_',
    resource: {
      loadPath: 'src/locales/{{lng}}.json',
      savePath: 'src/locales/{{lng}}.json',
      jsonIndent: 2
    },
    resourceFilePath: 'src/locales/{{lng}}.json',
    interpolation: {
      prefix: '{{',
      suffix: '}}'
    },
    metadata: {},
    logger: console,
    keyAsDefaultValue: false,
    saveMissing: false,
    returnEmptyString: false,
    returnNull: false,
    returnObjects: false,
    jsonIndent: 2,
    escapeValue: true,
    useKeysAsDefaultValue: false,
    skipPlurals: false,
    unescapePrefix: '-',
    restructure: false,
    nsSeparator: false,
    keySeparator: false,
    contextDefaultValues: [],
    pluralFallback: ['plural'],
    compatibilityJSON: 'v4'
  }
};
