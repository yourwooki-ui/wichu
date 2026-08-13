export const COUNTRY_CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR
PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN
SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW
TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`
  .trim()
  .split(/\s+/);

export type CountryOption = {
  code: string;
  name: string;
  searchAliases: string;
};

const COUNTRY_SEARCH_ALIASES: Record<string, string> = {
  AE: '아랍에미리트 UAE united arab emirates',
  AT: '오스트리아 austria',
  AU: '호주 australia',
  BR: '브라질 brazil',
  CA: '캐나다 canada',
  CH: '스위스 switzerland',
  CN: '중국 china',
  DE: '독일 germany',
  ES: '스페인 spain',
  FR: '프랑스 france',
  GB: '영국 UK united kingdom britain',
  HK: '홍콩 hong kong',
  ID: '인도네시아 indonesia',
  IN: '인도 india',
  IT: '이탈리아 italy',
  JP: '일본 japan',
  KP: '북한 north korea',
  KR: '한국 남한 korea south korea',
  MX: '멕시코 mexico',
  MY: '말레이시아 malaysia',
  NL: '네덜란드 netherlands holland',
  NZ: '뉴질랜드 new zealand',
  PH: '필리핀 philippines',
  RU: '러시아 russia',
  SA: '사우디 사우디아라비아 saudi arabia',
  SG: '싱가포르 singapore',
  TH: '태국 thailand',
  TR: '터키 튀르키예 turkey turkiye',
  TW: '대만 taiwan',
  US: '미국 아메리카 USA united states america',
  VN: '베트남 vietnam',
  ZA: '남아공 남아프리카공화국 south africa',
};

export function getCountryOptions(locale: string): CountryOption[] {
  const displayNames = new Intl.DisplayNames([locale], { type: 'region' });

  return COUNTRY_CODES.map((code) => ({
    code,
    name: displayNames.of(code) ?? code,
    searchAliases: COUNTRY_SEARCH_ALIASES[code] ?? '',
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}
