/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Injectable, inject } from '@angular/core';
import { TranslateService, LangChangeEvent } from '@ngx-translate/core';

import dePo from '../locales/de.po';
import jaPo from '../locales/ja.po';
import jaJpPo from '../locales/ja_JP.po';

/**
 * Parses a Gettext PO file content into a key-value dictionary.
 * The .po files under src/locales/ remain the single source of truth.
 */
export function parsePo(poContent: string): Record<string, string> {
  const translations: Record<string, string> = {};
  if (!poContent || typeof poContent !== 'string') return translations;

  const lines = poContent.split(/\r?\n/);
  let currentMsgId: string | null = null;
  let currentMsgStr: string | null = null;
  let state: 'none' | 'msgid' | 'msgstr' = 'none';

  const cleanString = (str: string): string => {
    const match = str.match(/^"([\s\S]*)"$/);
    if (!match) return '';
    return match[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\t/g, '\t');
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('msgid ')) {
      if (currentMsgId !== null && currentMsgStr !== null && currentMsgId !== '') {
        translations[currentMsgId] = currentMsgStr;
      }
      currentMsgId = cleanString(trimmed.slice(6).trim());
      currentMsgStr = null;
      state = 'msgid';
    } else if (trimmed.startsWith('msgstr ')) {
      currentMsgStr = cleanString(trimmed.slice(7).trim());
      state = 'msgstr';
    } else if (trimmed.startsWith('"')) {
      const continuation = cleanString(trimmed);
      if (state === 'msgid' && currentMsgId !== null) {
        currentMsgId += continuation;
      } else if (state === 'msgstr' && currentMsgStr !== null) {
        currentMsgStr += continuation;
      }
    }
  }

  if (currentMsgId !== null && currentMsgStr !== null && currentMsgId !== '') {
    translations[currentMsgId] = currentMsgStr;
  }

  return translations;
}

export const DE_TRANSLATIONS: Record<string, string> = parsePo(dePo);
export const JA_TRANSLATIONS: Record<string, string> = {
  ...parsePo(jaPo),
  ...parsePo(jaJpPo)
};

/**
 * Target language keys supported by Cumulocity for German and Japanese.
 */
const GERMAN_VARIANTS = ['de', 'de_DE', 'de-DE', 'de_de', 'de-de'];
const JAPANESE_VARIANTS = ['ja', 'ja_JP', 'ja-JP', 'ja_jp', 'ja-jp', 'ja-JA', 'ja_JA'];

export function loadWidgetTranslations(translate: TranslateService): void {
  if (!translate) return;

  for (const lang of GERMAN_VARIANTS) {
    translate.setTranslation(lang, DE_TRANSLATIONS, true);
  }
  for (const lang of JAPANESE_VARIANTS) {
    translate.setTranslation(lang, JA_TRANSLATIONS, true);
  }
}

@Injectable({ providedIn: 'root' })
export class WidgetTranslationService {
  private translate = inject(TranslateService, { optional: true });

  constructor() {
    if (this.translate) {
      loadWidgetTranslations(this.translate);
      this.translate.onLangChange.subscribe((_event: LangChangeEvent) => {
        if (this.translate) {
          loadWidgetTranslations(this.translate);
        }
      });
    }
  }

  ensureLoaded() {
    if (this.translate) {
      loadWidgetTranslations(this.translate);
    }
  }
}
