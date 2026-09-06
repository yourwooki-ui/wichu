from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "social-launch" / "source" / "campaign-premium-portrait-3x4.png"
OUTPUT = ROOT / "assets" / "social-launch" / "instagram" / "wichu-official-launch-1080x1440.jpg"

PINK = "#FF2D6F"
LIME = "#C9FF2E"
INK = "#111113"
WHITE = "#FFFFFF"
FONT_REGULAR = Path("C:/Windows/Fonts/NotoSansKR-VF.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/malgunbd.ttf")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size=size)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.convert("RGB").resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def add_gradient(canvas: Image.Image, start: int, end: int, maximum: int, reverse: bool = False) -> None:
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    span = max(1, end - start)
    for y in range(start, end):
        progress = (y - start) / span
        if reverse:
            progress = 1 - progress
        draw.line((0, y, canvas.width, y), fill=(17, 17, 19, round(maximum * progress)), width=1)
    canvas.alpha_composite(overlay)


def wordmark(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    label_font = font(49, True)
    draw.text((x, y), "WICHU", font=label_font, fill=WHITE)
    width = draw.textbbox((x, y), "WICHU", font=label_font)[2] - x
    draw.text((x + width - 10, y - 11), "♥", font=font(21, True), fill=PINK)


def rounded_label(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    fill: tuple[int, int, int, int] | str,
    color: str,
    outline: str | None = None,
) -> None:
    draw.rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=fill, outline=outline, width=2)
    draw.text(
        ((box[0] + box[2]) // 2, (box[1] + box[3]) // 2 - 1),
        text,
        font=font(20, True),
        fill=color,
        anchor="mm",
    )


def main() -> None:
    canvas = cover(Image.open(SOURCE), (1080, 1440)).convert("RGBA")

    # Keep the generated editorial lighting, adding only subtle legibility gradients.
    add_gradient(canvas, 0, 600, 82, reverse=True)
    add_gradient(canvas, 1030, 1440, 205)

    # A faint glass panel gives the copy a deliberate editorial block without hiding the set.
    glass = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glass)
    gdraw.rounded_rectangle((46, 42, 766, 515), radius=38, fill=(10, 10, 12, 76), outline=(255, 255, 255, 30), width=2)
    canvas.alpha_composite(glass.filter(ImageFilter.GaussianBlur(0.35)))

    draw = ImageDraw.Draw(canvas)
    wordmark(draw, 72, 67)
    draw.text((72, 166), "NEW LANGUAGE · NEW FRIENDS", font=font(19, True), fill=LIME)
    draw.multiline_text(
        (72, 218),
        "언어가 달라도\n친구가 될 수 있어요",
        font=font(57, True),
        fill=WHITE,
        spacing=10,
    )
    draw.text(
        (74, 400),
        "전 세계의 새로운 친구와 가볍게 대화를 시작하세요.",
        font=font(21),
        fill="#E6E5E8",
    )

    rounded_label(draw, (72, 1194, 389, 1260), "서로 Pick하면 대화 시작", (17, 17, 19, 214), WHITE, "#5A5A60")
    rounded_label(draw, (405, 1194, 598, 1260), "메시지 번역", LIME, INK)

    draw.text((72, 1322), "Pick your vibe.", font=font(27, True), fill=WHITE)
    draw.text((270, 1322), "WICHU", font=font(27, True), fill=PINK)
    draw.text((72, 1386), "만 18세 이상 · 연출 이미지", font=font(17), fill="#C6C6CB")
    draw.text((1008, 1386), "GLOBAL SOCIAL", font=font(17, True), fill="#C6C6CB", anchor="ra")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUTPUT, "JPEG", quality=96, optimize=True, progressive=True)


if __name__ == "__main__":
    main()
