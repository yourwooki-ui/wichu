import { describe, expect, it } from 'vitest';

import { LEGAL_DOCUMENTS, POLICY_STATUS, TBD_MARKER, type LegalDocument } from './legal-documents';

const documents = Object.values(LEGAL_DOCUMENTS) as LegalDocument[];
const allBodies = documents.flatMap((doc) => doc.sections.map((section) => section.body));
const pending = allBodies.filter((body) => body.includes(TBD_MARKER));

describe('정책 문서', () => {
  /**
   * 확정되지 않은 항목이 남은 채로 시행 상태를 켜면 스토어에 제출 가능한 문서가 된다.
   * 값 하나를 바꾸는 실수로 그렇게 되지 않도록 여기서 막는다.
   */
  it('시행 상태에서는 확정 필요 표시가 남아 있으면 안 된다', () => {
    if (POLICY_STATUS === 'effective') {
      expect(pending, `확정되지 않은 항목: ${pending.length}개`).toHaveLength(0);
    } else {
      expect(POLICY_STATUS).toBe('draft');
    }
  });

  it('개인정보처리방침이 처리 위탁과 국외 이전을 고지한다', () => {
    const titles = LEGAL_DOCUMENTS.privacy.sections.map((section) => section.title);
    expect(titles).toContain('처리 위탁');
    expect(titles).toContain('국외 이전');
  });

  it('메시지 원문을 외부로 보내는 번역 수탁사를 실명으로 밝힌다', () => {
    const body = LEGAL_DOCUMENTS.privacy.sections.map((section) => section.body).join('\n');
    expect(body).toContain('DeepL');
    expect(body).toContain('Supabase');
  });

  it('권리 행사 연락처를 제공한다', () => {
    const body = LEGAL_DOCUMENTS.privacy.sections.map((s) => s.body).join('\n');
    expect(body).toContain('support@wichu.app');
  });

  it('모든 문서에 제목과 본문이 있다', () => {
    for (const doc of documents) {
      expect(doc.title.length).toBeGreaterThan(0);
      expect(doc.sections.length).toBeGreaterThan(0);
      for (const section of doc.sections) {
        expect(section.body.length).toBeGreaterThan(10);
      }
    }
  });
});
