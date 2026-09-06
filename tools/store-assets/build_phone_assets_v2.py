from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "store-listing" / "source"
OUTPUT = ROOT / "assets" / "store-listing" / "ko-KR" / "v2-phone"
SOFT_ICONS = ROOT / "assets" / "soft-icons"

PINK = "#FF2D6F"
PINK_SOFT = "#FFF0F5"
INK = "#141416"
MUTED = "#71717A"
LINE = "#E8E6E4"
WHITE = "#FFFFFF"
CREAM = "#F8F7F4"
LIME = "#C9FF2E"
GOLD = "#D9A82E"

FONT_REGULAR = Path("C:/Windows/Fonts/NotoSansKR-VF.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/malgunbd.ttf")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size=size)


def cover(image: Image.Image, size: tuple[int, int], anchor: tuple[float, float] = (0.5, 0.5)) -> Image.Image:
    image = image.convert("RGB")
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = round((resized.width - size[0]) * anchor[0])
    top = round((resized.height - size[1]) * anchor[1])
    return resized.crop((left, top, left + size[0], top + size[1]))


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return mask


def paste_rounded(
    canvas: Image.Image,
    image: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    anchor: tuple[float, float] = (0.5, 0.5),
) -> None:
    size = (box[2] - box[0], box[3] - box[1])
    canvas.paste(cover(image, size, anchor), box[:2], rounded_mask(size, radius))


def shadow_panel(
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    radius: int = 52,
    fill: str = WHITE,
    shadow_alpha: int = 34,
) -> None:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    x0, y0, x1, y1 = box
    draw.rounded_rectangle((x0, y0 + 18, x1, y1 + 18), radius, fill=(20, 20, 22, shadow_alpha))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(24)))
    ImageDraw.Draw(canvas).rounded_rectangle(box, radius, fill=fill)


def logo(draw: ImageDraw.ImageDraw, x: int = 60, y: int = 58, size: int = 50, color: str = INK) -> None:
    draw.text((x, y), "WICHU", font=font(size, True), fill=color)
    draw.text((x + 122, y - 13), "♥", font=font(25, True), fill=PINK)


def header(canvas: Image.Image, eyebrow: str, first: str, second: str, *, second_color: str = PINK) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.text((64, 72), eyebrow, font=font(23, True), fill=PINK)
    draw.text((64, 128), first, font=font(58, True), fill=INK)
    draw.text((64, 204), second, font=font(58, True), fill=second_color)


def pill(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    *,
    fill: str = WHITE,
    color: str = INK,
    outline: str | None = None,
    text_size: int = 21,
    bold: bool = True,
) -> None:
    draw.rounded_rectangle(box, (box[3] - box[1]) // 2, fill=fill, outline=outline, width=2 if outline else 1)
    draw.text(((box[0] + box[2]) // 2, (box[1] + box[3]) // 2 - 2), text, font=font(text_size, bold), fill=color, anchor="mm")


def face_crop(group: Image.Image, key: str) -> Image.Image:
    crops = {
        "south_asian_woman": (815, 45, 1200, 430),
        "east_asian_man": (1160, 35, 1545, 420),
        "olive_man": (600, 300, 1050, 820),
        "east_asian_woman": (1015, 300, 1485, 845),
    }
    return group.crop(crops[key])


def save(image: Image.Image, name: str) -> None:
    image.convert("RGB").save(OUTPUT / name, "JPEG", quality=94, optimize=True, progressive=True)


def welcome(group: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), CREAM)
    canvas.paste(cover(group, (1080, 1110), (0.57, 0.5)), (0, 0))
    draw = ImageDraw.Draw(canvas)
    logo(draw)
    shadow_panel(canvas, (0, 1010, 1080, 1960), 68, WHITE, 25)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((450, 1054, 630, 1068), 7, fill="#DEDEE3")
    draw.text((64, 1130), "새로운 언어, 새로운 친구", font=font(25, True), fill=PINK)
    draw.text((64, 1194), "언어가 달라도", font=font(61, True), fill=INK)
    draw.text((64, 1274), "친구가 될 수 있어요", font=font(61, True), fill=INK)
    draw.text((66, 1380), "전 세계의 새로운 친구와 가볍게 대화를 시작해요.", font=font(27), fill=MUTED)
    draw.rounded_rectangle((58, 1490, 1022, 1588), 49, fill="#F5F4F6")
    draw.text((100, 1539), "♥", font=font(29, True), fill=PINK, anchor="mm")
    draw.text((138, 1539), "서로 Pick하면 대화 시작", font=font(23, True), fill=INK, anchor="lm")
    draw.ellipse((644, 1527, 668, 1551), fill="#648700")
    draw.text((696, 1539), "안전한 프로필", font=font(23, True), fill=INK, anchor="lm")
    draw.rounded_rectangle((58, 1634, 1022, 1750), 38, fill=PINK)
    draw.text((540, 1692), "WICHU 시작하기", font=font(31, True), fill=WHITE, anchor="mm")
    draw.text((540, 1822), "만 18세 이상만 이용할 수 있어요", font=font(20), fill=MUTED, anchor="mm")
    return canvas


def discovery(group: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), "#FFF8FA")
    header(canvas, "친구 발견", "전 세계의 새로운 친구를", "한 명씩 만나보세요")
    # A subtle next-card peek makes the swipe stack readable without a heavy device frame.
    shadow_panel(canvas, (138, 422, 942, 1794), 54, "#F1EEF0", 18)
    shadow_panel(canvas, (92, 382, 988, 1760), 58, WHITE, 40)
    card = (126, 488, 954, 1450)
    paste_rounded(canvas, face_crop(group, "east_asian_man"), card, 45, (0.5, 0.42))
    shade = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shade)
    for y in range(1010, 1450):
        alpha = round(205 * ((y - 1010) / 440) ** 1.6)
        sdraw.line((126, y, 954, y), fill=(0, 0, 0, alpha), width=1)
    canvas.alpha_composite(shade)
    draw = ImageDraw.Draw(canvas)
    logo(draw, 132, 407, 38)
    pill(draw, (156, 1114, 290, 1166), "● 온라인", fill="#EBFFD0", color="#486700", text_size=19)
    draw.text((156, 1196), "Ren, 27", font=font(50, True), fill=WHITE)
    draw.text((156, 1265), "12km · 일본어 · 영어", font=font(24), fill="#F3F3F4")
    x = 156
    for text, width in (("여행", 104), ("인디 음악", 148), ("커피", 104)):
        pill(draw, (x, 1320, x + width, 1372), text, fill="#29292DBF", color=WHITE, outline="#77777D", text_size=19)
        x += width + 12
    draw.rounded_rectangle((126, 1478, 954, 1608), 38, fill="#FAF9FA")
    draw.text((190, 1543), "X", font=font(34, True), fill="#686870", anchor="mm")
    draw.text((540, 1543), "프로필 보기", font=font(24, True), fill=INK, anchor="mm")
    draw.ellipse((815, 1498, 905, 1588), fill=PINK)
    draw.text((860, 1543), "♥", font=font(35, True), fill=WHITE, anchor="mm")
    draw.text((540, 1680), "최근 활동한 사람을 중심으로 보여드려요", font=font(21), fill=MUTED, anchor="mm")
    return canvas


def match(group: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), INK)
    draw = ImageDraw.Draw(canvas)
    draw.text((64, 72), "상호 Pick", font=font(23, True), fill=PINK)
    draw.text((64, 128), "서로 Pick한 순간", font=font(58, True), fill=WHITE)
    draw.text((64, 204), "대화가 열려요", font=font(58, True), fill=LIME)
    shadow_panel(canvas, (72, 382, 1008, 1770), 60, "#0B0B0D", 65)
    draw = ImageDraw.Draw(canvas)
    draw.text((540, 484), "IT'S A MATCH!", font=font(52, True), fill=LIME, anchor="mm")
    draw.text((540, 546), "두 사람의 관심이 이어졌어요", font=font(24), fill="#C8C8CE", anchor="mm")
    paste_rounded(canvas, face_crop(group, "south_asian_woman"), (174, 646, 494, 966), 160)
    paste_rounded(canvas, face_crop(group, "olive_man"), (586, 646, 906, 966), 160)
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((170, 642, 498, 970), outline=PINK, width=10)
    draw.ellipse((582, 642, 910, 970), outline=LIME, width=10)
    draw.ellipse((494, 754, 586, 846), fill=INK, outline=PINK, width=4)
    draw.text((540, 799), "♥", font=font(35, True), fill=PINK, anchor="mm")
    draw.text((540, 1054), "첫 대화를 시작해보세요", font=font(35, True), fill=WHITE, anchor="mm")
    draw.text((540, 1110), "관심사 하나면 충분해요", font=font(22), fill="#AEADB5", anchor="mm")
    draw.rounded_rectangle((154, 1200, 926, 1316), 58, fill=PINK)
    draw.text((540, 1258), "첫 인사 보내기", font=font(29, True), fill=WHITE, anchor="mm")
    draw.rounded_rectangle((154, 1340, 926, 1456), 58, fill="#242428", outline="#4A4A51", width=2)
    draw.text((540, 1398), "계속 발견하기", font=font(27, True), fill=WHITE, anchor="mm")
    return canvas


def chat(group: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), "#FFF8FA")
    header(canvas, "번역 채팅", "언어가 달라도", "대화는 자연스럽게")
    shadow_panel(canvas, (72, 380, 1008, 1910), 58, WHITE, 36)
    draw = ImageDraw.Draw(canvas)
    avatar = face_crop(group, "south_asian_woman")
    paste_rounded(canvas, avatar, (120, 430, 216, 526), 48)
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((194, 502, 218, 526), fill=LIME, outline=WHITE, width=3)
    draw.text((240, 447), "Maya", font=font(30, True), fill=INK)
    draw.text((240, 490), "온라인 · 24km", font=font(19), fill=MUTED)
    pill(draw, (790, 445, 940, 507), "번역", fill=PINK_SOFT, color=PINK, outline="#FFD0DF", text_size=21)
    draw.line((112, 560, 968, 560), fill=LINE, width=2)
    draw.text((540, 612), "오늘", font=font(19, True), fill="#9B9BA2", anchor="mm")
    draw.rounded_rectangle((120, 686, 746, 850), 32, fill="#F1F0F1")
    draw.text((154, 724), "That playlist was so good!", font=font(25), fill=INK)
    pill(draw, (154, 774, 282, 828), "번역 보기", fill=WHITE, color=PINK, outline="#FFD0DF", text_size=18)
    draw.rounded_rectangle((330, 916, 940, 1046), 32, fill=PINK)
    draw.text((900, 981), "나도 네 추천이 궁금해", font=font(25), fill=WHITE, anchor="rm")
    draw.rounded_rectangle((120, 1110, 782, 1322), 32, fill="#F1F0F1")
    draw.text((154, 1148), "I made a weekend list for you.", font=font(25), fill=INK)
    draw.text((154, 1210), "주말에 들을 곡들을 골라봤어.", font=font(22), fill=PINK)
    draw.text((154, 1265), "한국어로 번역됨", font=font(17, True), fill=MUTED)
    draw.rounded_rectangle((112, 1640, 968, 1738), 49, fill="#F7F6F7", outline=LINE, width=2)
    draw.text((150, 1689), "메시지 보내기", font=font(22), fill="#A2A2AA", anchor="lm")
    draw.ellipse((866, 1653, 956, 1725), fill=PINK)
    draw.text((911, 1689), "↑", font=font(28, True), fill=WHITE, anchor="mm")
    draw.text((540, 1812), "번역은 원할 때만 눌러서 확인해요", font=font(20), fill=MUTED, anchor="mm")
    return canvas


def profile(group: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), "#F4F8F5")
    header(canvas, "상세 프로필", "사진보다 더 많은", "이야기를 알아가요")
    shadow_panel(canvas, (72, 382, 1008, 1935), 58, WHITE, 34)
    hero = (104, 420, 976, 1110)
    paste_rounded(canvas, face_crop(group, "olive_man"), hero, 44, (0.5, 0.42))
    shade = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shade)
    for y in range(800, 1110):
        alpha = round(180 * ((y - 800) / 310) ** 1.5)
        sdraw.line((104, y, 976, y), fill=(0, 0, 0, alpha), width=1)
    canvas.alpha_composite(shade)
    draw = ImageDraw.Draw(canvas)
    draw.text((144, 956), "Leo, 28", font=font(48, True), fill=WHITE)
    draw.text((144, 1020), "8km · 스페인어 · 영어", font=font(23), fill="#F2F2F3")
    draw.rounded_rectangle((104, 1140, 976, 1278), 30, fill="#FCFBFC", outline=LINE, width=2)
    draw.text((140, 1170), "소개", font=font(21, True), fill=PINK)
    draw.text((140, 1213), "새로운 도시를 걷고 작은 카페를 찾는 걸 좋아해요.", font=font(22), fill=INK)
    draw.text((112, 1330), "기본 정보", font=font(26, True), fill=INK)
    items = [("직장", "제품 디자이너"), ("키", "178cm"), ("학력", "대학교")]
    x = 112
    for label, text in items:
        draw.rounded_rectangle((x, 1380, x + 268, 1488), 26, fill="#F6F5F4")
        draw.text((x + 28, 1410), label, font=font(16, True), fill=PINK)
        draw.text((x + 28, 1454), text, font=font(20, True), fill=INK, anchor="lm")
        x += 286
    draw.text((112, 1542), "관심사", font=font(26, True), fill=INK)
    pill(draw, (112, 1592, 238, 1652), "여행", fill=PINK_SOFT, color=PINK, outline="#FFD0DF")
    pill(draw, (252, 1592, 410, 1652), "사진", fill=PINK_SOFT, color=PINK, outline="#FFD0DF")
    pill(draw, (424, 1592, 598, 1652), "재즈", fill=PINK_SOFT, color=PINK, outline="#FFD0DF")
    draw.text((112, 1710), "사용 언어", font=font(26, True), fill=INK)
    draw.text((112, 1765), "스페인어  ·  영어", font=font(23, True), fill=INK)
    return canvas


def filters() -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), CREAM)
    header(canvas, "탐색 조건", "거리와 언어를", "내 기준으로 골라요")
    shadow_panel(canvas, (72, 382, 1008, 1900), 58, WHITE, 34)
    draw = ImageDraw.Draw(canvas)
    draw.text((118, 442), "관심 있는 사람", font=font(28, True), fill=INK)
    x = 118
    for label, selected, width in (("여성", False, 150), ("남성", False, 150), ("모두", True, 150)):
        pill(draw, (x, 500, x + width, 566), label, fill=PINK_SOFT if selected else WHITE, color=PINK if selected else MUTED, outline="#FFBFD3" if selected else LINE, text_size=22)
        x += width + 18
    draw.text((118, 642), "선호 나이", font=font(27, True), fill=INK)
    draw.text((946, 644), "21세 – 36세", font=font(24, True), fill=PINK, anchor="ra")
    draw.rounded_rectangle((126, 726, 938, 740), 7, fill="#DDDCE0")
    draw.rounded_rectangle((236, 726, 540, 740), 7, fill=PINK)
    draw.ellipse((216, 704, 260, 748), fill=WHITE, outline=PINK, width=5)
    draw.ellipse((518, 704, 562, 748), fill=WHITE, outline=PINK, width=5)
    draw.text((118, 822), "거리", font=font(27, True), fill=INK)
    draw.text((946, 824), "100km 이하", font=font(24, True), fill=PINK, anchor="ra")
    draw.rounded_rectangle((126, 906, 938, 920), 7, fill="#DDDCE0")
    draw.rounded_rectangle((126, 906, 590, 920), 7, fill=PINK)
    draw.ellipse((104, 884, 148, 928), fill=WHITE, outline=PINK, width=5)
    draw.ellipse((568, 884, 612, 928), fill=WHITE, outline=PINK, width=5)
    draw.text((118, 1000), "사용 언어", font=font(27, True), fill=INK)
    pill(draw, (118, 1058, 326, 1124), "영어", fill="#F7F6F5", outline=LINE, text_size=21)
    pill(draw, (342, 1058, 572, 1124), "일본어", fill="#F7F6F5", outline=LINE, text_size=21)
    pill(draw, (588, 1058, 840, 1124), "프랑스어", fill="#F7F6F5", outline=LINE, text_size=21)
    draw.text((118, 1212), "같은 국적 프로필 제외", font=font(25, True), fill=INK)
    draw.text((118, 1258), "더 다양한 친구를 먼저 보여드려요", font=font(20), fill=MUTED)
    draw.rounded_rectangle((842, 1208, 946, 1266), 29, fill=PINK)
    draw.ellipse((890, 1212, 942, 1262), fill=WHITE)
    draw.rounded_rectangle((112, 1426, 968, 1544), 59, fill=INK)
    draw.text((540, 1485), "이 조건으로 발견하기", font=font(28, True), fill=WHITE, anchor="mm")
    draw.text((540, 1640), "언제든 다시 바꿀 수 있어요", font=font(21), fill=MUTED, anchor="mm")
    return canvas


def safety() -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), "#F7FAF8")
    header(canvas, "안전한 연결", "불편한 순간에는", "바로 멈출 수 있어요")
    shadow_panel(canvas, (72, 382, 1008, 1900), 58, WHITE, 34)
    icon = Image.open(SOFT_ICONS / "safety.png").convert("RGBA")
    icon.thumbnail((250, 250), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon, ((1080 - icon.width) // 2, 440))
    draw = ImageDraw.Draw(canvas)
    draw.text((540, 732), "내 연결은 내가 직접 관리해요", font=font(28, True), fill=INK, anchor="mm")
    cards = [
        ("신고하기", "사유를 선택해 운영팀에 알려요", "!", PINK_SOFT, PINK),
        ("차단하기", "서로의 프로필과 메시지를 숨겨요", "×", "#F4F3F3", INK),
        ("대화방 나가기", "대화를 종료하고 목록에서 정리해요", "↗", "#F4F8EE", "#5B7600"),
    ]
    y = 810
    for title, body, symbol, fill, accent in cards:
        draw.rounded_rectangle((116, y, 964, y + 154), 34, fill=fill, outline=LINE, width=2)
        draw.ellipse((146, y + 39, 222, y + 115), fill=WHITE)
        draw.text((184, y + 77), symbol, font=font(31, True), fill=accent, anchor="mm")
        draw.text((252, y + 43), title, font=font(25, True), fill=INK)
        draw.text((252, y + 91), body, font=font(20), fill=MUTED)
        y += 178
    draw.rounded_rectangle((116, 1376, 964, 1516), 32, fill=INK)
    draw.text((154, 1410), "정확한 위치는 공개하지 않아요", font=font(24, True), fill=WHITE)
    draw.text((154, 1462), "상대에게는 거리 정보만 표시됩니다", font=font(20), fill="#CDCDD3")
    pill(draw, (116, 1562, 336, 1626), "18세 이상만 이용", fill=PINK_SOFT, color=PINK, outline="#FFD0DF", text_size=19)
    return canvas


def gold() -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), "#FFF9E8")
    draw = ImageDraw.Draw(canvas)
    draw.text((64, 72), "WICHU GOLD", font=font(23, True), fill=GOLD)
    draw.text((64, 128), "더 편하게 연결되는", font=font(58, True), fill=INK)
    draw.text((64, 204), "프리미엄 경험", font=font(58, True), fill=GOLD)
    shadow_panel(canvas, (72, 382, 1008, 1900), 58, WHITE, 34)
    icon = Image.open(SOFT_ICONS / "gold-pass.png").convert("RGBA")
    icon.thumbnail((280, 280), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon, ((1080 - icon.width) // 2, 438))
    draw = ImageDraw.Draw(canvas)
    draw.text((540, 740), "GOLD PASS", font=font(36, True), fill=INK, anchor="mm")
    draw.text((540, 792), "필요한 기능만 더 편하게", font=font(22), fill=MUTED, anchor="mm")
    benefits = [
        ("◆", "방문한 사람 확인", "내 프로필을 본 사람을 확인해요"),
        ("R", "무제한 되돌리기", "놓친 프로필을 바로 다시 봐요"),
        ("↑", "노출 우선순위", "새로운 사람에게 먼저 보여요"),
        ("×", "광고 없이 이용", "흐름을 끊지 않고 계속 탐색해요"),
    ]
    y = 886
    for symbol, title, body in benefits:
        draw.rounded_rectangle((118, y, 962, y + 142), 32, fill="#FFFBF0", outline="#F0DFC0", width=2)
        draw.ellipse((146, y + 33, 222, y + 109), fill="#FFF2C9")
        draw.text((184, y + 71), symbol, font=font(29, True), fill=GOLD, anchor="mm")
        draw.text((252, y + 35), title, font=font(24, True), fill=INK)
        draw.text((252, y + 82), body, font=font(20), fill=MUTED)
        y += 162
    draw.text((540, 1638), "구독은 언제든 Google Play에서 관리할 수 있어요", font=font(19), fill=MUTED, anchor="mm")
    return canvas


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    group = Image.open(SOURCE / "feature-inclusive-v2.png").convert("RGB")
    assets = [
        (welcome(group), "01-welcome-1080x1920.jpg"),
        (discovery(group), "02-discover-1080x1920.jpg"),
        (match(group), "03-match-1080x1920.jpg"),
        (chat(group), "04-translation-chat-1080x1920.jpg"),
        (profile(group), "05-profile-1080x1920.jpg"),
        (filters(), "06-filters-1080x1920.jpg"),
        (safety(), "07-safety-1080x1920.jpg"),
        (gold(), "08-gold-1080x1920.jpg"),
    ]
    for image, name in assets:
        save(image, name)
    print(f"Generated {len(assets)} phone screenshots in {OUTPUT}")


if __name__ == "__main__":
    main()
