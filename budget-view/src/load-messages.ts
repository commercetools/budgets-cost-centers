// Loads the UI text; English is the only message file. [BCC-VIEW-10]
import {
  type TI18NImportData,
  type TMessageTranslations,
  parseChunkImport,
} from '@commercetools-frontend/i18n';

const getChunkImport = (_locale: string): Promise<TI18NImportData> =>
  import(
    /* webpackChunkName: "app-i18n-en" */
    './i18n/data/en.json'
  );

const loadMessages = async (locale: string): Promise<TMessageTranslations> => {
  try {
    const chunkImport = await getChunkImport(locale);
    return parseChunkImport(chunkImport);
  } catch (error) {
    console.warn(
      `Something went wrong while loading the app messages for ${locale}`,
      error
    );
    return {};
  }
};

export default loadMessages;
