from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[2]
SOCIAL = ROOT / "assets" / "social-launch"
SOURCE = SOCIAL / "source"
IG_OUT = SOCIAL / "instagram"
TT_OUT = SOCIAL / "tiktok"
STORE = ROOT / "assets" / "store-listing" / "ko-KR" / "v2-phone"
BRAND = ROOT / "assets" / "brand"

PINK = "#FF2D6F"
PINK_LIGHT = "#FFF0F5"
LIME = "#C9FF2E"
INK = "#111113"
CREAM = "#F8F7F4"
WHITE = "#FFFFFF"
MUTED = "#77777F"
LINE = "#E8E6E4"

FONT_REGULAR = Path("C:/Windows/Fonts/NotoSansKR-VF.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/malgunbd.ttf")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size=size)


def rgba(color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    color = color.removeprefix("#")
    return tuple(int(color[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def cover(image: Image.Image, size: tuple[int, int], anchor: tuple[float, float] = (0.5, 0.5)) -> Image.Image:
    image = image.convert("RGB")
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = round((resized.width - size[0]) * anchor[0])
    top = round((resized.height - size[1]) * anchor[1])
    return resized.crop((left, top, left + size[0], top + size[1]))


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    image = image.convert("RGBA")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    return image


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
    radius: int,
    fill: str,
    shadow_alpha: int = 42,
    blur: int = 30,
) -> None:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    x0, y0, x1, y1 = box
    draw.rounded_rectangle((x0, y0 + 18, x1, y1 + 18), radius, fill=(0, 0, 0, shadow_alpha))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(blur)))
    ImageDraw.Draw(canvas).rounded_rectangle(box, radius, fill=fill)


def gradient(canvas: Image.Image, top: int, bottom: int, color: str, max_alpha: int, reverse: bool = False) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    rgb = rgba(color)[:3]
    height = max(1, bottom - top)
    for y in range(top, bottom):
        progress = (y - top) / height
        if reverse:
            progress = 1 - progress
        draw.line((0, y, canvas.width, y), fill=rgb + (round(max_alpha * progress),))
    canvas.alpha_composite(overlay)


def wordmark(draw: ImageDraw.ImageDraw, x: int, y: int, color: str, size: int = 54) -> None:
    draw.text((x, y), "WICHU", font=font(size, True), fill=color)
    width = draw.textbbox((x, y), "WICHU", font=font(size, True))[2] - x
    draw.text((x + width - 12, y - size * 0.23), "♥", font=font(round(size * 0.43), True), fill=PINK)


def badge(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill: str, color: str, size: int = 22) -> int:
    box = draw.textbbox((0, 0), text, font=font(size, True))
    width = box[2] - box[0] + 46
    height = size + 30
    draw.rounded_rectangle((x, y, x + width, y + height), height // 2, fill=fill)
    draw.text((x + width // 2, y + height // 2 - 1), text, font=font(size, True), fill=color, anchor="mm")
    return width


def multiline(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, size: int, color: str, spacing: int = 12) -> None:
    draw.multiline_text(xy, text, font=font(size, True), fill=color, spacing=spacing)


def footer(draw: ImageDraw.ImageDraw, width: int, y: int, color: str) -> None:
    draw.text((68, y), "만 18세 이상 · 연출 이미지", font=font(18), fill=color)
    draw.text((width - 68, y), "@wichu.app", font=font(18, True), fill=color, anchor="ra")


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, "JPEG", quality=95, optimize=True, progressive=True)


def contact_sheet(paths: list[Path], output: Path, thumb_size: tuple[int, int], columns: int = 3) -> None:
    rows = (len(paths) + columns - 1) // columns
    gap = 20
    label_height = 42
    width = columns * thumb_size[0] + (columns + 1) * gap
    height = rows * (thumb_size[1] + label_height) + (rows + 1) * gap
    sheet = Image.new("RGB", (width, height), "#E9E7E5")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(paths):
        col = index % columns
        row = index // columns
        x = gap + col * (thumb_size[0] + gap)
        y = gap + row * (thumb_size[1] + label_height + gap)
        thumb = cover(Image.open(path), thumb_size)
        sheet.paste(thumb, (x, y))
        draw.text((x, y + thumb_size[1] + 8), path.stem, font=font(16, True), fill=INK)
    sheet.save(output, "JPEG", quality=92, optimize=True)


def ig_hero(group: Image.Image) -> Image.Image:
    canvas = cover(group, (1080, 1080), (0.5, 0.42)).convert("RGBA")
    gradient(canvas, 0, 250, INK, 150, reverse=True)
    gradient(canvas, 560, 1080, INK, 235)
    draw = ImageDraw.Draw(canvas)
    wordmark(draw, 66, 58, WHITE, 55)
    badge(draw, 66, 680, "GLOBAL SOCIAL · 18+", LIME, INK, 20)
    multiline(draw, (66, 758), "새로운 언어,\n새로운 친구", 72, WHITE, 8)
    draw.text((68, 943), "Pick your vibe. WICHU", font=font(25, True), fill=PINK)
    footer(draw, 1080, 1028, "#D7D7DB")
    return canvas


def ig_pick(mutual: Image.Image) -> Image.Image:
    canvas = cover(mutual, (1080, 1080), (0.5, 0.57)).convert("RGBA")
    gradient(canvas, 0, 340, INK, 220, reverse=True)
    gradient(canvas, 720, 1080, INK, 180)
    draw = ImageDraw.Draw(canvas)
    wordmark(draw, 66, 58, WHITE, 48)
    multiline(draw, (66, 162), "서로 Pick하면\n대화가 시작돼요", 62, WHITE, 8)
    badge(draw, 66, 906, "TWO PEOPLE. ONE PICK.", PINK, WHITE, 20)
    footer(draw, 1080, 1028, WHITE)
    return canvas


def ig_translation(screen: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1080), PINK_LIGHT)
    draw = ImageDraw.Draw(canvas)
    wordmark(draw, 64, 54, INK, 46)
    draw.text((64, 142), "CHAT & TRANSLATE", font=font(20, True), fill=PINK)
    multiline(draw, (64, 184), "언어가 달라도\n대화는 자연스럽게", 55, INK, 6)
    shadow_panel(canvas, (560, 68, 1010, 1020), 54, WHITE, 38)
    paste_rounded(canvas, screen, (582, 90, 988, 998), 38, (0.5, 0.32))
    draw = ImageDraw.Draw(canvas)
    badge(draw, 64, 412, "원문과 번역을 함께", WHITE, INK, 20)
    badge(draw, 64, 484, "필요할 때만 번역", LIME, INK, 20)
    draw.rounded_rectangle((64, 624, 500, 804), 34, fill=INK)
    draw.text((100, 666), "That was so good!", font=font(25), fill=WHITE)
    draw.text((100, 724), "정말 좋았어!", font=font(27, True), fill=PINK)
    draw.text((100, 770), "한국어로 번역됨", font=font(17), fill="#B8B8BE")
    footer(draw, 1080, 1028, MUTED)
    return canvas


def ig_discover(screen: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1080), CREAM)
    draw = ImageDraw.Draw(canvas)
    wordmark(draw, 64, 54, INK, 46)
    draw.text((64, 142), "DISCOVER", font=font(20, True), fill=PINK)
    multiline(draw, (64, 182), "전 세계의 친구를\n한 명씩 만나보세요", 54, INK, 6)
    shadow_panel(canvas, (570, 54, 1012, 1022), 54, WHITE, 35)
    paste_rounded(canvas, screen, (592, 76, 990, 1000), 38, (0.5, 0.3))
    draw = ImageDraw.Draw(canvas)
    badge(draw, 64, 418, "사진 · 관심사 · 언어", WHITE, INK, 20)
    badge(draw, 64, 490, "왼쪽 PASS · 오른쪽 PICK", PINK, WHITE, 20)
    draw.text((64, 634), "누구나 말고,", font=font(30, True), fill=MUTED)
    draw.text((64, 680), "내 취향에 가까운 한 명.", font=font(35, True), fill=INK)
    footer(draw, 1080, 1028, MUTED)
    return canvas


def ig_safety(screen: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1080), INK)
    draw = ImageDraw.Draw(canvas)
    wordmark(draw, 64, 54, WHITE, 46)
    draw.text((64, 142), "SAFETY FIRST", font=font(20, True), fill=LIME)
    multiline(draw, (64, 182), "안전한 연결은\n기본이어야 하니까", 54, WHITE, 6)
    shadow_panel(canvas, (590, 74, 1018, 1028), 52, "#222226", 70)
    paste_rounded(canvas, screen, (610, 94, 998, 1008), 36, (0.5, 0.26))
    draw = ImageDraw.Draw(canvas)
    items = [("정확한 위치 비공개", PINK), ("사진 검토", LIME), ("신고·차단", WHITE)]
    y = 452
    for text, color in items:
        draw.ellipse((68, y + 4, 86, y + 22), fill=color)
        draw.text((104, y), text, font=font(25, True), fill=WHITE)
        y += 72
    draw.rounded_rectangle((64, 730, 506, 884), 32, fill=PINK)
    draw.text((96, 770), "서로 Pick한 뒤에만", font=font(22), fill=WHITE)
    draw.text((96, 812), "1:1 대화가 열려요", font=font(28, True), fill=WHITE)
    footer(draw, 1080, 1028, "#B9B9BF")
    return canvas


def ig_founding(group: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1080), INK)
    paste_rounded(canvas, group, (536, 54, 1026, 1026), 56, (0.52, 0.45))
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    for x in range(430, 720):
        alpha = round(255 * (1 - (x - 430) / 290))
        odraw.line((x, 0, x, 1080), fill=(17, 17, 19, alpha), width=1)
    canvas.alpha_composite(overlay)
    draw = ImageDraw.Draw(canvas)
    wordmark(draw, 64, 54, WHITE, 46)
    badge(draw, 64, 168, "FOUNDING 300", LIME, INK, 22)
    multiline(draw, (64, 260), "위츄의 첫\n300명을 찾습니다", 60, WHITE, 8)
    draw.text((66, 452), "한국과 세계를 연결하는", font=font(25), fill="#D3D3D8")
    draw.text((66, 492), "초기 멤버가 되어주세요.", font=font(25, True), fill=PINK)
    draw.rounded_rectangle((64, 620, 450, 722), 32, fill=PINK)
    draw.text((257, 671), "프로필 링크에서 신청", font=font(23, True), fill=WHITE, anchor="mm")
    draw.text((64, 778), "EARLY ACCESS · 18+", font=font(20, True), fill=LIME)
    footer(draw, 1080, 1028, "#C8C8CD")
    return canvas


def tiktok_photo_cover(
    photo: Image.Image,
    headline: str,
    eyebrow: str,
    filename: str,
    anchor: tuple[float, float] = (0.5, 0.5),
) -> None:
    canvas = cover(photo, (1080, 1920), anchor).convert("RGBA")
    gradient(canvas, 0, 650, INK, 235, reverse=True)
    gradient(canvas, 1180, 1920, INK, 220)
    draw = ImageDraw.Draw(canvas)
    wordmark(draw, 72, 112, WHITE, 54)
    draw.text((72, 244), eyebrow, font=font(22, True), fill=LIME)
    multiline(draw, (72, 292), headline, 68, WHITE, 10)
    badge(draw, 72, 1550, "GLOBAL SOCIAL · 18+", PINK, WHITE, 21)
    draw.text((72, 1644), "Pick your vibe. WICHU", font=font(29, True), fill=WHITE)
    footer(draw, 1080, 1800, "#D8D8DD")
    save(canvas, TT_OUT / filename)


def tiktok_screen_cover(screen: Image.Image, eyebrow: str, headline: str, note: str, filename: str, accent: str) -> None:
    canvas = Image.new("RGBA", (1080, 1920), INK)
    draw = ImageDraw.Draw(canvas)
    wordmark(draw, 72, 108, WHITE, 54)
    draw.text((72, 240), eyebrow, font=font(22, True), fill=accent)
    multiline(draw, (72, 288), headline, 64, WHITE, 10)
    shadow_panel(canvas, (164, 590, 916, 1740), 70, "#242428", 72, 40)
    paste_rounded(canvas, screen, (190, 616, 890, 1714), 50, (0.5, 0.2))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((72, 1620, 1008, 1746), 40, fill=rgba(INK, 236))
    draw.text((540, 1683), note, font=font(25, True), fill=WHITE, anchor="mm")
    footer(draw, 1080, 1810, "#BEBEC5")
    save(canvas, TT_OUT / filename)


def tiktok_founding(group: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (1080, 1920), INK)
    paste_rounded(canvas, group, (64, 760, 1016, 1620), 64, (0.5, 0.48))
    gradient(canvas, 1260, 1700, INK, 200)
    draw = ImageDraw.Draw(canvas)
    wordmark(draw, 72, 108, WHITE, 54)
    badge(draw, 72, 248, "FOUNDING 300", LIME, INK, 24)
    multiline(draw, (72, 354), "위츄의 첫\n300명을 찾습니다", 72, WHITE, 10)
    draw.text((74, 580), "한국과 세계를 연결하는 초기 멤버", font=font(27), fill="#D0D0D5")
    draw.rounded_rectangle((72, 1670, 1008, 1788), 38, fill=PINK)
    draw.text((540, 1729), "프로필 링크에서 사전 신청", font=font(28, True), fill=WHITE, anchor="mm")
    footer(draw, 1080, 1830, "#BEBEC5")
    return canvas


def main() -> None:
    group = Image.open(SOURCE / "campaign-friends-square.png")
    mutual = Image.open(SOURCE / "campaign-mutual-pick-vertical.png")
    discover = Image.open(STORE / "02-discover-1080x1920.jpg")
    translation = Image.open(STORE / "04-translation-chat-1080x1920.jpg")
    safety = Image.open(STORE / "07-safety-1080x1920.jpg")

    instagram = [
        ("01-brand-hero-1080x1080.jpg", ig_hero(group)),
        ("02-mutual-pick-1080x1080.jpg", ig_pick(mutual)),
        ("03-translation-1080x1080.jpg", ig_translation(translation)),
        ("04-discover-1080x1080.jpg", ig_discover(discover)),
        ("05-safety-1080x1080.jpg", ig_safety(safety)),
        ("06-founding-300-1080x1080.jpg", ig_founding(group)),
    ]
    for name, image in instagram:
        save(image, IG_OUT / name)

    tiktok_photo_cover(
        group,
        "언어가 달라도\n친구가 될 수 있어요",
        "NEW LANGUAGE · NEW FRIENDS",
        "01-brand-hero-1080x1920.jpg",
        (0.5, 0.5),
    )
    tiktok_photo_cover(
        mutual,
        "서로 Pick하면\n대화가 시작돼요",
        "TWO PEOPLE · ONE PICK",
        "02-mutual-pick-1080x1920.jpg",
        (0.5, 0.5),
    )
    tiktok_screen_cover(
        translation,
        "CHAT & TRANSLATE",
        "외국어 메시지를\n바로 이해하는 방법",
        "원문은 그대로 · 필요한 메시지만 번역",
        "03-translation-1080x1920.jpg",
        PINK,
    )
    tiktok_screen_cover(
        discover,
        "DISCOVER",
        "전 세계의 친구를\n한 명씩 발견하세요",
        "왼쪽 PASS · 오른쪽 PICK",
        "04-discover-1080x1920.jpg",
        LIME,
    )
    tiktok_screen_cover(
        safety,
        "SAFETY FIRST",
        "안전한 연결은\n기본이어야 하니까",
        "정확한 위치 비공개 · 신고와 차단",
        "05-safety-1080x1920.jpg",
        LIME,
    )
    save(tiktok_founding(group), TT_OUT / "06-founding-300-1080x1920.jpg")

    contact_sheet(sorted(IG_OUT.glob("*.jpg")), SOCIAL / "instagram-contact-sheet.jpg", (360, 360))
    contact_sheet(sorted(TT_OUT.glob("*.jpg")), SOCIAL / "tiktok-contact-sheet.jpg", (270, 480))


if __name__ == "__main__":
    main()
