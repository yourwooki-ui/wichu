from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "store-listing" / "source"
OUTPUT = ROOT / "assets" / "store-listing" / "ko-KR"

PINK = "#FF2D6F"
LIME = "#C9FF2E"
INK = "#111111"
GRAY = "#6F7178"
SOFT = "#F4F3F2"
LINE = "#E6E4E2"
WHITE = "#FFFFFF"
GOLD = "#E8B94F"

FONT_REGULAR = Path("C:/Windows/Fonts/NotoSansKR-VF.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/malgunbd.ttf")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size=size)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return mask


def cover(image: Image.Image, size: tuple[int, int], anchor: tuple[float, float] = (0.5, 0.5)) -> Image.Image:
    src = image.convert("RGB")
    ratio = max(size[0] / src.width, size[1] / src.height)
    resized = src.resize((round(src.width * ratio), round(src.height * ratio)), Image.Resampling.LANCZOS)
    left = round((resized.width - size[0]) * anchor[0])
    top = round((resized.height - size[1]) * anchor[1])
    return resized.crop((left, top, left + size[0], top + size[1]))


def paste_rounded(
    canvas: Image.Image,
    image: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    anchor: tuple[float, float] = (0.5, 0.5),
) -> None:
    width, height = box[2] - box[0], box[3] - box[1]
    fitted = cover(image, (width, height), anchor)
    canvas.paste(fitted, box[:2], rounded_mask((width, height), radius))


def pill(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    *,
    fill: str = WHITE,
    color: str = INK,
    outline: str | None = None,
    size: int = 27,
    pad_x: int = 22,
    height: int = 54,
    bold: bool = False,
) -> int:
    f = font(size, bold)
    width = round(draw.textlength(text, font=f)) + pad_x * 2
    box = (xy[0], xy[1], xy[0] + width, xy[1] + height)
    draw.rounded_rectangle(box, height // 2, fill=fill, outline=outline, width=2 if outline else 1)
    text_box = draw.textbbox((0, 0), text, font=f)
    text_y = xy[1] + (height - (text_box[3] - text_box[1])) // 2 - text_box[1] - 1
    draw.text((xy[0] + pad_x, text_y), text, font=f, fill=color)
    return width


def flag(draw: ImageDraw.ImageDraw, xy: tuple[int, int], code: str, width: int = 48, height: int = 32) -> None:
    x, y = xy
    draw.rounded_rectangle((x - 2, y - 2, x + width + 2, y + height + 2), 8, fill=WHITE)
    if code == "DE":
        colors = ("#151515", "#E22B2B", "#F2C230")
        for index, color in enumerate(colors):
            draw.rectangle((x, y + index * height // 3, x + width, y + (index + 1) * height // 3), fill=color)
    elif code == "ES":
        draw.rectangle((x, y, x + width, y + height), fill="#F4C430")
        draw.rectangle((x, y, x + width, y + 7), fill="#C81D25")
        draw.rectangle((x, y + height - 7, x + width, y + height), fill="#C81D25")
    else:
        draw.rounded_rectangle((x, y, x + width, y + height), 6, fill="#EFEDEF", outline=LINE, width=1)
        draw.text((x + width // 2, y + height // 2), code, font=font(15, True), fill=INK, anchor="mm")


def info_icon(draw: ImageDraw.ImageDraw, xy: tuple[int, int], kind: str) -> None:
    x, y = xy
    draw.rounded_rectangle((x, y, x + 46, y + 46), 13, fill=WHITE, outline=LINE, width=2)
    if kind == "work":
        draw.rounded_rectangle((x + 10, y + 16, x + 36, y + 34), 4, outline=INK, width=3)
        draw.arc((x + 17, y + 8, x + 29, y + 21), 180, 360, fill=INK, width=3)
    elif kind == "height":
        draw.line((x + 23, y + 9, x + 23, y + 37), fill=INK, width=3)
        draw.polygon([(x + 23, y + 7), (x + 17, y + 14), (x + 29, y + 14)], fill=INK)
        draw.polygon([(x + 23, y + 39), (x + 17, y + 32), (x + 29, y + 32)], fill=INK)
    else:
        draw.polygon([(x + 8, y + 18), (x + 23, y + 9), (x + 38, y + 18), (x + 23, y + 27)], fill=INK)
        draw.line((x + 13, y + 23, x + 13, y + 34, x + 33, y + 34, x + 33, y + 23), fill=INK, width=3)


def draw_logo(canvas: Image.Image, xy: tuple[int, int], width: int, *, dark: bool = False) -> None:
    source = Image.open(ROOT / "assets" / "brand" / ("wichu-splash.png" if dark else "wichu-app-icon.png")).convert("RGBA")
    pixels = source.load()
    alpha = Image.new("L", source.size, 0)
    alpha_px = alpha.load()
    for y in range(source.height):
        for x in range(source.width):
            r, g, b, _ = pixels[x, y]
            if dark:
                keep = max(r, g, b) > 80
            else:
                keep = min(r, g, b) < 205 or (r > 220 and g < 150)
            alpha_px[x, y] = 255 if keep else 0
    bbox = alpha.getbbox()
    if not bbox:
        return
    cropped = source.crop(bbox)
    cropped_alpha = alpha.crop(bbox)
    target_h = round(width * cropped.height / cropped.width)
    cropped = cropped.resize((width, target_h), Image.Resampling.LANCZOS)
    cropped_alpha = cropped_alpha.resize((width, target_h), Image.Resampling.LANCZOS)
    cropped.putalpha(cropped_alpha)
    canvas.alpha_composite(cropped, xy)


def headline(canvas: Image.Image, kicker: str, lines: Iterable[tuple[str, str]], *, dark: bool = False) -> None:
    draw = ImageDraw.Draw(canvas)
    base = WHITE if dark else INK
    draw.text((74, 74), kicker, font=font(24, True), fill=PINK)
    y = 126
    for text, color in lines:
        draw.text((74, y), text, font=font(58, True), fill=color or base)
        y += 76


def phone_shell(canvas: Image.Image, box: tuple[int, int, int, int], *, screen_fill: str = WHITE) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    x0, y0, x1, y1 = box
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle((x0 + 12, y0 + 22, x1 + 12, y1 + 22), 74, fill=(0, 0, 0, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    canvas.alpha_composite(shadow)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(box, 72, fill="#080808")
    screen_box = (x0 + 18, y0 + 18, x1 - 18, y1 - 18)
    draw.rounded_rectangle(screen_box, 58, fill=screen_fill)
    screen = Image.new("RGBA", (screen_box[2] - screen_box[0], screen_box[3] - screen_box[1]), screen_fill)
    return screen, ImageDraw.Draw(screen)


def finish_phone(canvas: Image.Image, screen: Image.Image, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    screen_box = (x0 + 18, y0 + 18, x1 - 18, y1 - 18)
    canvas.paste(screen, screen_box[:2], rounded_mask(screen.size, 58))
    draw = ImageDraw.Draw(canvas)
    notch_w = 154
    notch_x = (x0 + x1 - notch_w) // 2
    draw.rounded_rectangle((notch_x, y0 + 28, notch_x + notch_w, y0 + 50), 12, fill="#080808")


def nav_bar(draw: ImageDraw.ImageDraw, width: int, y: int, active: str) -> None:
    draw.line((36, y, width - 36, y), fill=LINE, width=2)
    labels = [("매치", "◉"), ("채팅", "□"), ("발견", "●"), ("상점", "◇"), ("나", "○")]
    positions = [86, 216, 346, 476, 606]
    for (label, symbol), x in zip(labels, positions):
        selected = label == active
        color = PINK if selected else "#A5A5AA"
        draw.text((x, y + 20), symbol, font=font(36, True), fill=color, anchor="mm")
        draw.text((x, y + 61), label, font=font(18, selected), fill=color, anchor="mm")


def make_discover() -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), SOFT)
    headline(canvas, "GLOBAL DISCOVERY", [("전 세계의 새로운 사람을", INK), ("한 명씩 발견해요", PINK)])
    box = (174, 334, 906, 1790)
    screen, draw = phone_shell(canvas, box)
    draw.text((46, 60), "WICHU", font=font(34, True), fill=INK)
    draw.ellipse((535, 45, 595, 105), fill="#F6F5F4", outline=LINE, width=2)
    draw.text((565, 73), "≡", font=font(28, True), fill=INK, anchor="mm")
    draw.ellipse((610, 45, 670, 105), fill="#FFF4E3", outline="#F0D7A1", width=2)
    draw.text((640, 74), "●", font=font(18, True), fill="#F5B82E", anchor="mm")
    portrait = Image.open(SOURCE / "lina.jpg")
    card_box = (34, 126, 680, 1180)
    paste_rounded(screen, portrait, card_box, 44, (0.5, 0.34))
    overlay = Image.new("RGBA", screen.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    odraw.rounded_rectangle(card_box, 44, outline=(255, 255, 255, 65), width=3)
    for index in range(5):
        odraw.rounded_rectangle((58 + index * 119, 148, 157 + index * 119, 155), 4, fill=(255, 255, 255, 225 if index == 0 else 100))
    grad = Image.new("L", (1, 500))
    for iy in range(500):
        grad.putpixel((0, iy), int(230 * (iy / 499) ** 1.9))
    grad = grad.resize((646, 500))
    shade = Image.new("RGBA", (646, 500), (0, 0, 0, 255))
    shade.putalpha(grad)
    overlay.alpha_composite(shade, (34, 680))
    screen.alpha_composite(overlay)
    draw = ImageDraw.Draw(screen)
    pill(draw, (60, 790), "● 온라인", fill="#ECFFD0", color="#456500", size=20, height=44, pad_x=16, bold=True)
    draw.text((60, 853), "Lina, 24", font=font(48, True), fill=WHITE)
    flag(draw, (280, 866), "DE", 50, 32)
    draw.text((60, 918), "18km · 독일어 · 영어", font=font(25), fill="#F2F2F2")
    x = 60
    for tag in ("디자인", "인디 음악", "여행"):
        x += pill(draw, (x, 970), tag, fill="#343438", color=WHITE, outline="#727279", size=20, height=46, pad_x=15) + 10
    draw.text((357, 1078), "왼쪽 Pass   ·   오른쪽 Pick", font=font(22), fill="#F1F1F1", anchor="mm")
    nav_bar(draw, screen.width, 1232, "발견")
    finish_phone(canvas, screen, box)
    return canvas


def make_match() -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), INK)
    headline(canvas, "MUTUAL PICK", [("서로 Pick한 순간", WHITE), ("새로운 연결이 시작돼요", LIME)], dark=True)
    box = (174, 334, 906, 1790)
    screen, draw = phone_shell(canvas, box, screen_fill="#0B0B0D")
    draw.text((357, 116), "IT'S A MATCH!", font=font(54, True), fill=LIME, anchor="mm")
    draw.text((357, 184), "서로 Pick했어요", font=font(25), fill="#D8D8DC", anchor="mm")
    lina = Image.open(SOURCE / "lina.jpg")
    mia = Image.open(SOURCE / "mia.jpg")
    paste_rounded(screen, lina, (76, 285, 344, 553), 134, (0.5, 0.32))
    paste_rounded(screen, mia, (370, 285, 638, 553), 134, (0.5, 0.32))
    draw = ImageDraw.Draw(screen)
    draw.ellipse((72, 281, 348, 557), outline=PINK, width=8)
    draw.ellipse((366, 281, 642, 557), outline=LIME, width=8)
    draw.ellipse((326, 387, 388, 449), fill=INK, outline=PINK, width=3)
    draw.text((357, 418), "♥", font=font(27, True), fill=PINK, anchor="mm")
    draw.text((357, 650), "Lina와 첫 대화를 시작해보세요", font=font(30, True), fill=WHITE, anchor="mm")
    draw.text((357, 708), "프로필의 관심사에서 가볍게 시작하면 좋아요", font=font(21), fill="#BDBDC4", anchor="mm")
    draw.rounded_rectangle((60, 805, 654, 905), 50, fill=PINK)
    draw.text((357, 855), "첫 인사 보내기", font=font(28, True), fill=WHITE, anchor="mm")
    draw.rounded_rectangle((60, 930, 654, 1030), 50, fill="#222226", outline="#45454C", width=2)
    draw.text((357, 980), "계속 발견하기", font=font(27, True), fill=WHITE, anchor="mm")
    draw.text((357, 1150), "Two people. One pick.", font=font(22, True), fill="#777780", anchor="mm")
    finish_phone(canvas, screen, box)
    return canvas


def make_chat() -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), "#FFF8FA")
    headline(canvas, "TRANSLATED CHAT", [("언어가 달라도", INK), ("대화는 자연스럽게", PINK)])
    box = (174, 334, 906, 1790)
    screen, draw = phone_shell(canvas, box)
    mia = Image.open(SOURCE / "mia.jpg")
    paste_rounded(screen, mia, (48, 52, 128, 132), 40, (0.5, 0.30))
    draw = ImageDraw.Draw(screen)
    draw.ellipse((106, 109, 126, 129), fill=LIME, outline=WHITE, width=3)
    draw.text((148, 65), "Mia", font=font(29, True), fill=INK)
    draw.text((148, 103), "온라인 · 24km", font=font(18), fill=GRAY)
    pill(draw, (516, 66), "번역", fill="#FFF0F5", color=PINK, outline="#FFD0DF", size=20, height=48, pad_x=17, bold=True)
    draw.line((34, 156, 680, 156), fill=LINE, width=2)
    draw.text((357, 192), "오늘", font=font(18, True), fill="#9A9AA0", anchor="mm")
    draw.rounded_rectangle((42, 258, 504, 380), 28, fill="#F0EFF0")
    draw.text((70, 287), "That playlist was actually so good!", font=font(23), fill=INK)
    draw.text((70, 334), "그 플레이리스트 정말 좋았어!", font=font(19), fill=PINK)
    draw.rounded_rectangle((185, 430, 672, 535), 28, fill=PINK)
    draw.text((644, 463), "나도 네 추천이 궁금해", font=font(23), fill=WHITE, anchor="ra")
    draw.rounded_rectangle((42, 588, 478, 735), 28, fill="#F0EFF0")
    draw.text((70, 617), "I made a weekend list for you.", font=font(23), fill=INK)
    draw.text((70, 665), "주말에 들을 곡들을 골라봤어.", font=font(19), fill=PINK)
    draw.text((70, 704), "번역됨", font=font(16, True), fill="#A0A0A5")
    draw.rounded_rectangle((36, 1168, 678, 1242), 37, fill="#F6F5F5", outline=LINE, width=2)
    draw.text((64, 1205), "메시지 보내기", font=font(21), fill="#A0A0A5", anchor="lm")
    draw.ellipse((614, 1176, 670, 1232), fill=PINK)
    draw.text((642, 1204), "↑", font=font(25, True), fill=WHITE, anchor="mm")
    finish_phone(canvas, screen, box)
    return canvas


def slider(draw: ImageDraw.ImageDraw, y: int, left: int, right: int, start: float, end: float, labels: tuple[str, str]) -> None:
    draw.rounded_rectangle((left, y, right, y + 10), 5, fill="#DEDDE0")
    sx = round(left + (right - left) * start)
    ex = round(left + (right - left) * end)
    draw.rounded_rectangle((sx, y, ex, y + 10), 5, fill=PINK)
    draw.ellipse((sx - 18, y - 13, sx + 28, y + 33), fill=WHITE, outline=PINK, width=5)
    draw.ellipse((ex - 23, y - 13, ex + 23, y + 33), fill=WHITE, outline=PINK, width=5)
    draw.text((left, y + 36), labels[0], font=font(18, True), fill=GRAY)
    draw.text((right, y + 36), labels[1], font=font(18, True), fill=GRAY, anchor="ra")


def make_filters() -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), "#F6F5F3")
    headline(canvas, "DISCOVERY FILTERS", [("국가·나이·거리까지", INK), ("내 기준으로 찾아요", PINK)])
    box = (174, 334, 906, 1790)
    screen, draw = phone_shell(canvas, box)
    draw.text((42, 68), "탐색 조건", font=font(34, True), fill=INK)
    draw.text((664, 72), "완료", font=font(23, True), fill=PINK, anchor="ra")
    draw.line((34, 135, 680, 135), fill=LINE, width=2)
    draw.text((42, 190), "관심 있는 사람", font=font(25, True), fill=INK)
    x = 42
    for label, selected in (("여성", True), ("남성", False), ("모두", False)):
        x += pill(draw, (x, 237), label, fill="#FFF0F5" if selected else WHITE, color=PINK if selected else GRAY, outline="#FFC4D7" if selected else LINE, size=21, height=52, pad_x=22, bold=selected) + 12
    draw.text((42, 348), "선호 나이", font=font(25, True), fill=INK)
    draw.text((664, 350), "21세 – 32세", font=font(23, True), fill=PINK, anchor="ra")
    slider(draw, 414, 52, 654, 0.10, 0.28, ("18", "90"))
    draw.text((42, 510), "거리", font=font(25, True), fill=INK)
    draw.text((664, 512), "100km 이하", font=font(23, True), fill=PINK, anchor="ra")
    slider(draw, 575, 52, 654, 0.0, 0.48, ("1km", "무제한"))
    draw.text((42, 670), "국가", font=font(25, True), fill=INK)
    x = 42
    for label in ("JP 일본", "DE 독일", "FR 프랑스"):
        width = pill(draw, (x, 718), label, fill="#F7F6F5", color=INK, outline=LINE, size=20, height=52, pad_x=16)
        x += width + 10
    draw.text((42, 831), "언어", font=font(25, True), fill=INK)
    x = 42
    for label in ("EN 영어", "JP 일본어"):
        width = pill(draw, (x, 878), label, fill="#F7F6F5", color=INK, outline=LINE, size=20, height=52, pad_x=16)
        x += width + 10
    draw.text((42, 1008), "같은 국적 프로필 제외", font=font(23, True), fill=INK)
    draw.text((42, 1047), "더 다양한 국가의 사람을 먼저 보여드려요", font=font(18), fill=GRAY)
    draw.rounded_rectangle((584, 1001, 664, 1047), 23, fill=PINK)
    draw.ellipse((624, 1004, 662, 1044), fill=WHITE)
    draw.rounded_rectangle((42, 1152, 664, 1242), 45, fill=INK)
    draw.text((353, 1197), "이 조건으로 발견하기", font=font(26, True), fill=WHITE, anchor="mm")
    finish_phone(canvas, screen, box)
    return canvas


def make_profile() -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), "#F3F7F4")
    headline(canvas, "RICH PROFILES", [("사진 너머의 취향까지", INK), ("천천히 알아가요", PINK)])
    box = (174, 334, 906, 1790)
    screen, draw = phone_shell(canvas, box)
    sofia = Image.open(SOURCE / "sofia.jpg")
    paste_rounded(screen, sofia, (0, 0, 714, 720), 50, (0.5, 0.29))
    shade = Image.new("RGBA", screen.size, (0, 0, 0, 0))
    sh = ImageDraw.Draw(shade)
    sh.rectangle((0, 430, 714, 720), fill=(0, 0, 0, 95))
    screen.alpha_composite(shade)
    draw = ImageDraw.Draw(screen)
    draw.text((44, 575), "Sofia, 25", font=font(45, True), fill=WHITE)
    flag(draw, (280, 587), "ES", 50, 32)
    draw.text((44, 638), "31km · 6일 전 접속", font=font(23), fill="#F2F2F2")
    pill(draw, (44, 675), "◆ GOLD", fill="#251F12CC", color="#FFD876", outline="#FFD876", size=18, height=42, pad_x=15, bold=True)
    draw.rounded_rectangle((24, 744, 690, 875), 30, fill=WHITE, outline=LINE, width=2)
    draw.text((48, 772), "소개", font=font(21, True), fill=PINK)
    draw.text((48, 814), "해변 산책과 도예, 조금 긴 음성 메시지를\n좋아해요.", font=font(21), fill=INK, spacing=8)
    draw.text((32, 926), "기본 정보", font=font(25, True), fill=INK)
    info = [("work", "세라믹 아티스트"), ("height", "170cm"), ("school", "전문대")]
    y = 976
    for icon, label in info:
        draw.rounded_rectangle((32, y, 682, y + 70), 24, fill="#F7F6F5")
        info_icon(draw, (50, y + 12), icon)
        draw.text((118, y + 35), label, font=font(21, True), fill=INK, anchor="lm")
        y += 82
    draw.text((32, 1225), "관심사", font=font(25, True), fill=INK)
    x = 32
    for tag in ("도예", "댄스", "바다"):
        x += pill(draw, (x, 1272), tag, fill="#FFF0F5", color=PINK, outline="#FFD0DF", size=18, height=46, pad_x=17, bold=True) + 10
    finish_phone(canvas, screen, box)
    return canvas


def make_safety() -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), "#F8F7F5")
    headline(canvas, "SAFETY FIRST", [("불편하거나 안전하지 않다면", INK), ("바로 멈출 수 있어요", PINK)])
    box = (174, 334, 906, 1790)
    screen, draw = phone_shell(canvas, box)
    draw.text((42, 68), "안전 및 개인정보", font=font(32, True), fill=INK)
    draw.text((42, 121), "내 연결은 내가 직접 관리해요", font=font(20), fill=GRAY)
    safety_icon = Image.open(ROOT / "assets" / "soft-icons" / "safety.png").convert("RGBA")
    safety_icon.thumbnail((210, 210), Image.Resampling.LANCZOS)
    screen.alpha_composite(safety_icon, ((screen.width - safety_icon.width) // 2, 190))
    draw = ImageDraw.Draw(screen)
    cards = [
        ("신고하기", "가이드 위반 내용을 운영팀에 알려요", "!", "#FFF0F5", PINK),
        ("차단하기", "서로의 프로필과 메시지를 숨겨요", "×", "#F3F2F2", INK),
        ("대화방 나가기", "대화를 종료하고 목록에서 정리해요", "↗", "#F6F7EF", "#607800"),
    ]
    y = 470
    for title, body, symbol, fill, accent in cards:
        draw.rounded_rectangle((34, y, 680, y + 150), 30, fill=fill, outline=LINE, width=2)
        draw.ellipse((58, y + 39, 130, y + 111), fill=WHITE)
        draw.text((94, y + 75), symbol, font=font(31, True), fill=accent, anchor="mm")
        draw.text((154, y + 43), title, font=font(24, True), fill=INK)
        draw.text((154, y + 89), body, font=font(18), fill=GRAY)
        y += 174
    draw.rounded_rectangle((34, 1035, 680, 1165), 28, fill="#111111")
    draw.text((62, 1066), "정확한 위치는 공개하지 않아요", font=font(22, True), fill=WHITE)
    draw.text((62, 1110), "상대에게는 거리 정보만 표시됩니다", font=font(18), fill="#CFCFD3")
    pill(draw, (34, 1205), "18세 이상만 이용", fill="#FFF0F5", color=PINK, outline="#FFD0DF", size=19, height=48, pad_x=18, bold=True)
    finish_phone(canvas, screen, box)
    return canvas


def build_feature_graphic() -> Image.Image:
    art = Image.open(SOURCE / "feature-key-art.png").convert("RGB")
    canvas = cover(art, (1024, 500), (0.5, 0.5)).convert("RGBA")
    veil = Image.new("RGBA", canvas.size, (255, 255, 255, 0))
    vdraw = ImageDraw.Draw(veil)
    for x in range(620):
        alpha = int(244 * (1 - x / 620) ** 0.9)
        vdraw.line((x, 0, x, 500), fill=(255, 255, 255, alpha))
    canvas.alpha_composite(veil)
    draw_logo(canvas, (62, 88), 255)
    draw = ImageDraw.Draw(canvas)
    draw.text((64, 244), "Pick your vibe.", font=font(48, True), fill=INK)
    draw.text((66, 314), "전 세계의 새로운 사람을 발견하고", font=font(25, True), fill=INK)
    draw.text((66, 356), "서로 Pick하면 대화를 시작하세요", font=font(25), fill=GRAY)
    pill(draw, (64, 408), "GLOBAL SOCIAL DISCOVERY", fill=INK, color=WHITE, size=16, height=38, pad_x=17, bold=True)
    return canvas


def build_icon() -> Image.Image:
    icon = Image.open(ROOT / "assets" / "brand" / "wichu-app-icon.png").convert("RGB")
    return icon.resize((512, 512), Image.Resampling.LANCZOS)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    build_icon().save(OUTPUT / "app-icon-512.png", format="PNG", optimize=True)
    build_feature_graphic().convert("RGB").save(OUTPUT / "feature-graphic-1024x500.jpg", format="JPEG", quality=94, optimize=True)
    screenshots = [make_discover(), make_match(), make_chat(), make_filters(), make_profile(), make_safety()]
    names = [
        "01-discover-1080x1920.jpg",
        "02-match-1080x1920.jpg",
        "03-translation-chat-1080x1920.jpg",
        "04-filters-1080x1920.jpg",
        "05-profile-1080x1920.jpg",
        "06-safety-1080x1920.jpg",
    ]
    for image, name in zip(screenshots, names):
        image.convert("RGB").save(OUTPUT / name, format="JPEG", quality=94, optimize=True)


if __name__ == "__main__":
    main()
