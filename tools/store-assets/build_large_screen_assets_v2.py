from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[2]
PHONE = ROOT / "assets" / "store-listing" / "ko-KR" / "v2-phone"
OUTPUT_ROOT = ROOT / "assets" / "store-listing" / "ko-KR"

INK = "#151519"
PINK = "#FF2D6F"
WHITE = "#FFFFFF"
LINE = "#E8E5E4"

FONT_REGULAR = Path("C:/Windows/Fonts/NotoSansKR-VF.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/malgunbd.ttf")

SLIDES = [
    ("01-welcome", "새로운 언어, 새로운 친구", "전 세계의 친구를 편안하게 만나요"),
    ("02-discover", "한 사람씩 천천히 발견", "사진과 관심사, 사용 언어를 함께 확인해요"),
    ("03-match", "서로 Pick하면 Match", "관심이 이어진 사람과만 대화를 시작해요"),
    ("04-translation-chat", "필요할 때만 번역", "원문을 그대로 두고 선택한 언어로 확인해요"),
    ("05-profile", "사진보다 더 자세한 프로필", "기본 정보와 관심사, 언어 수준까지 살펴봐요"),
    ("06-filters", "내 기준에 맞춘 발견", "나이와 거리, 언어 조건을 직접 조절해요"),
    ("07-safety", "불편하면 바로 멈추기", "신고와 차단, 대화방 나가기를 쉽게 이용해요"),
    ("08-gold", "더 편리한 GOLD PASS", "방문자 확인과 되돌리기, 광고 제거를 이용해요"),
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size=size)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return mask


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = min(size[0] / image.width, size[1] / image.height)
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)


def shadow_card(canvas: Image.Image, box: tuple[int, int, int, int], radius: int = 48) -> None:
    x0, y0, x1, y1 = box
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x0, y0 + 24, x1, y1 + 24), radius, fill=(25, 20, 22, 42))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(32)))
    ImageDraw.Draw(canvas).rounded_rectangle(box, radius, fill=WHITE, outline=LINE, width=2)


def soft_background(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    background = cover(source.convert("RGB"), size).filter(ImageFilter.GaussianBlur(70)).convert("RGBA")
    background.alpha_composite(Image.new("RGBA", size, (250, 248, 246, 220)))
    draw = ImageDraw.Draw(background)
    draw.ellipse((-180, -260, 820, 740), fill=(255, 45, 111, 24))
    draw.ellipse((size[0] - 730, size[1] - 690, size[0] + 150, size[1] + 160), fill=(201, 255, 46, 34))
    return background


def wordmark(draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> None:
    draw.text((x, y), "WICHU", font=font(size, True), fill=INK)
    draw.text((x + round(size * 2.45), y - round(size * 0.28)), "♥", font=font(round(size * 0.5), True), fill=PINK)


def build_seven_inch(source: Image.Image) -> Image.Image:
    return source.resize((1440, 2560), Image.Resampling.LANCZOS)


def build_ten_inch(source: Image.Image, title: str, body: str) -> Image.Image:
    canvas = soft_background(source, (2560, 1440))
    draw = ImageDraw.Draw(canvas)
    wordmark(draw, 132, 102, 62)
    draw.text((132, 348), title, font=font(64, True), fill=INK)
    draw.text((132, 448), body, font=font(29, True), fill="#4A1027")
    draw.rounded_rectangle((132, 565, 474, 627), 31, fill="#FFF0F5", outline="#FFD0DF", width=2)
    draw.text((303, 596), "WICHU 핵심 경험", font=font(22, True), fill=PINK, anchor="mm")

    box = (1430, 70, 2410, 1370)
    shadow_card(canvas, box, 58)
    inner = contain(source.convert("RGB"), (900, 1220))
    px = box[0] + (box[2] - box[0] - inner.width) // 2
    py = box[1] + (box[3] - box[1] - inner.height) // 2
    canvas.paste(inner, (px, py), rounded_mask(inner.size, 34))

    crop = source.crop((68, 370, 1012, 1340)).convert("RGB")
    crop = cover(crop, (1110, 560))
    crop_box = (132, 730, 1242, 1290)
    shadow_card(canvas, crop_box, 44)
    canvas.paste(crop, crop_box[:2], rounded_mask((1110, 560), 42))
    return canvas


def build_chromebook(first: Image.Image, second: Image.Image, title: str, body: str) -> Image.Image:
    canvas = soft_background(first, (2560, 1440))
    draw = ImageDraw.Draw(canvas)
    window = (92, 72, 2468, 1368)
    shadow_card(canvas, window, 34)
    draw.rounded_rectangle((92, 72, 2468, 154), 34, fill="#F3F2F2")
    draw.rectangle((92, 120, 2468, 154), fill="#F3F2F2")
    for index, color in enumerate(("#FF6B6B", "#FFD166", "#80CFA9")):
        draw.ellipse((132 + index * 44, 102, 152 + index * 44, 122), fill=color)
    draw.rounded_rectangle((690, 94, 1870, 134), 20, fill=WHITE, outline="#DEDCDD", width=2)
    draw.text((1280, 114), "wichu.app", font=font(18), fill="#77747A", anchor="mm")

    wordmark(draw, 158, 210, 52)
    draw.text((158, 354), title, font=font(55, True), fill=INK)
    draw.text((158, 432), body, font=font(27), fill="#68656C")

    for x, image in ((1420, first), (1900, second)):
        panel = contain(image.convert("RGB"), (420, 940))
        px = x + (420 - panel.width) // 2
        py = 242 + (940 - panel.height) // 2
        card_box = (x - 24, 216, x + 444, 1230)
        shadow_card(canvas, card_box, 40)
        canvas.paste(panel, (px, py), rounded_mask(panel.size, 24))

    detail = cover(second.crop((70, 390, 1010, 1400)).convert("RGB"), (1100, 550))
    detail_box = (158, 642, 1258, 1192)
    shadow_card(canvas, detail_box, 40)
    canvas.paste(detail, detail_box[:2], rounded_mask((1100, 550), 38))
    draw.text((158, 1270), "큰 화면에서도 핵심 정보와 조작이 선명하게 보여요", font=font(22, True), fill="#706D73")
    return canvas


def save(image: Image.Image, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(output, "JPEG", quality=93, optimize=True, progressive=True)


def save_contact_sheet(images: list[Image.Image], output: Path, columns: int) -> None:
    thumb_size = (420, 236)
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * 444 + 24, rows * 260 + 24), "#EEECEA")
    for index, image in enumerate(images):
        thumb = contain(image.convert("RGB"), thumb_size)
        x = 24 + (index % columns) * 444 + (thumb_size[0] - thumb.width) // 2
        y = 24 + (index // columns) * 260 + (thumb_size[1] - thumb.height) // 2
        sheet.paste(thumb, (x, y))
    save(sheet, output)


def main() -> None:
    phone_images: list[Image.Image] = []
    seven_images: list[Image.Image] = []
    ten_images: list[Image.Image] = []
    for stem, title, body in SLIDES:
        path = PHONE / f"{stem}-1080x1920.jpg"
        image = Image.open(path).convert("RGB")
        phone_images.append(image)
        seven = build_seven_inch(image)
        ten = build_ten_inch(image, title, body)
        seven_images.append(seven)
        ten_images.append(ten)
        save(seven, OUTPUT_ROOT / "v2-tablet-7" / f"{stem}-1440x2560.jpg")
        save(ten, OUTPUT_ROOT / "v2-tablet-10" / f"{stem}-2560x1440.jpg")

    chromebook_pairs = [
        (0, 1, "처음부터 발견까지 자연스럽게", "새로운 친구를 만나고 프로필을 편안하게 살펴보세요."),
        (2, 3, "Match에서 번역 채팅까지", "서로 Pick한 사람과 필요한 순간에만 번역해 대화하세요."),
        (4, 5, "프로필과 탐색 조건을 한눈에", "상세 정보와 내 기준을 큰 화면에서도 또렷하게 확인하세요."),
        (6, 7, "안전과 편의 기능도 가까이", "신고·차단과 GOLD PASS 기능을 쉽게 이용하세요."),
    ]
    chromebook_images: list[Image.Image] = []
    for number, (first, second, title, body) in enumerate(chromebook_pairs, start=1):
        chromebook = build_chromebook(phone_images[first], phone_images[second], title, body)
        chromebook_images.append(chromebook)
        save(
            chromebook,
            OUTPUT_ROOT / "v2-chromebook" / f"{number:02d}-wichu-2560x1440.jpg",
        )

    qa = OUTPUT_ROOT / "v2-qa"
    save_contact_sheet(seven_images, qa / "tablet-7-contact.jpg", 4)
    save_contact_sheet(ten_images, qa / "tablet-10-contact.jpg", 2)
    save_contact_sheet(chromebook_images, qa / "chromebook-contact.jpg", 2)

    print("Generated 8 seven-inch, 8 ten-inch, and 4 Chromebook screenshots")


if __name__ == "__main__":
    main()
