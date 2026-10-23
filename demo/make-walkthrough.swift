import AppKit
import AVFoundation
import CoreText
import CoreVideo

let fps: Int32 = 30
let width = 1920
let height = 1080
let assets = "/Users/surendarnatarajan/.cursor/projects/Users-surendarnatarajan-Documents-upteams-clone/assets"
let output = URL(fileURLWithPath: "/Users/surendarnatarajan/Documents/fixsure/demo/tap-repair-walkthrough.mp4")

struct Scene {
    var image: String?
    var kicker: String
    var title: String
    var lines: [String]
    var seconds: Double
    var focusStart: CGPoint
    var focusEnd: CGPoint
    var zoomStart: CGFloat
    var zoomEnd: CGFloat
}

let scenes: [Scene] = [
    Scene(image: nil, kicker: "FIXSURE", title: "A water-tap repair,\nstep by step", lines: ["From the sandbox run: price the photo, hold the money, prove the fix."], seconds: 4.2, focusStart: .zero, focusEnd: .zero, zoomStart: 1, zoomEnd: 1),
    Scene(image: "\(assets)/fixsure-before.jpg", kicker: "STEP 1  ·  THE PROBLEM", title: "A tap leaking at the base", lines: ["The customer uploads one photo.", "Water is pooling on the counter around the faucet."], seconds: 6.5, focusStart: CGPoint(x: 0.5, y: 0.45), focusEnd: CGPoint(x: 0.48, y: 0.55), zoomStart: 1.0, zoomEnd: 1.12),
    Scene(image: "\(assets)/33361802-9552-4AAD-9652-55C54553723E-9146cc3d-69c5-4c75-87ae-049f0c4c0cbc.png", kicker: "STEP 2  ·  PRICED AND HELD", title: "PayPal authorizes $120", lines: ["Vision priced the repair at $80 labor and $40 for seals.", "The customer approved the hold. Nothing is charged yet."], seconds: 9.0, focusStart: CGPoint(x: 0.5, y: 0.42), focusEnd: CGPoint(x: 0.58, y: 0.48), zoomStart: 1.0, zoomEnd: 1.06),
    Scene(image: "\(assets)/36F8C57F-2A9B-48DC-9819-9732EF1B8B63-4012354c-a296-4dff-a2d2-6bdcb824082f.png", kicker: "STEP 2  ·  STILL ONLY A HOLD", title: "Waiting for the technician", lines: ["$120 stays authorized until 9 November.", "The customer is charged only if the after photo passes."], seconds: 6.5, focusStart: CGPoint(x: 0.5, y: 0.5), focusEnd: CGPoint(x: 0.56, y: 0.5), zoomStart: 1.0, zoomEnd: 1.04),
    Scene(image: "\(assets)/fixsure-after-dry.jpg", kicker: "STEP 3  ·  THE PROOF", title: "The same tap, now dry", lines: ["The technician uploads the after photo.", "Same sink, same angle. The puddle and the crust are gone."], seconds: 6.0, focusStart: CGPoint(x: 0.5, y: 0.42), focusEnd: CGPoint(x: 0.46, y: 0.4), zoomStart: 1.0, zoomEnd: 1.1),
    Scene(image: "\(assets)/04F086ED-BE30-4068-BDB3-22DF563A911E-caceb1ee-5242-4ff5-94fd-b41c01f7b1be.png", kicker: "STEP 4  ·  CHECKED AND CAPTURED", title: "The model releases the money", lines: ["90% sure, above the 82% line, so it auto-releases.", "PayPal captures $120. The $108 payout is refused: the business account is in India."], seconds: 10.0, focusStart: CGPoint(x: 0.5, y: 0.38), focusEnd: CGPoint(x: 0.58, y: 0.5), zoomStart: 1.0, zoomEnd: 1.06),
    Scene(image: "\(assets)/7D72BE56-080F-4CB2-AE8B-9928DF8C3DE4-7fbfa10f-997b-4770-861d-49a38ab68b41.png", kicker: "STEP 5  ·  THE TIMELINE", title: "Six events, fourteen minutes", lines: ["9:16 priced and the PayPal order is created.", "9:29 the hold is approved. 9:30 the photo passes, $120 is captured, the payout fails."], seconds: 8.5, focusStart: CGPoint(x: 0.5, y: 0.5), focusEnd: CGPoint(x: 0.46, y: 0.55), zoomStart: 1.0, zoomEnd: 1.04),
    Scene(image: nil, kicker: "WHAT THIS RUN SHOWED", title: "India can hold and capture.\nIt cannot pay the technician.", lines: ["Authorize and capture both succeeded on the India sandbox account.", "PayPal Payouts refused the $108 because that business account is in India."], seconds: 5.5, focusStart: .zero, focusEnd: .zero, zoomStart: 1, zoomEnd: 1),
]

func color(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: r, green: g, blue: b, alpha: a)
}

func loadCG(_ path: String) -> CGImage? {
    guard let image = NSImage(contentsOfFile: path) else { return nil }
    var rect = CGRect(origin: .zero, size: image.size)
    return image.cgImage(forProposedRect: &rect, context: nil, hints: [.interpolation: NSNumber(value: NSImageInterpolation.high.rawValue)])
}

func smooth(_ t: CGFloat) -> CGFloat {
    t * t * (3 - 2 * t)
}

func drawText(_ text: String, font: NSFont, color: CGColor, in ctx: CGContext, at point: CGPoint, maxWidth: CGFloat) -> CGFloat {
    let style = NSMutableParagraphStyle()
    style.lineBreakMode = .byWordWrapping
    let attr = NSAttributedString(string: text, attributes: [
        .font: font,
        .foregroundColor: NSColor(cgColor: color) ?? .white,
        .paragraphStyle: style,
    ])
    let framesetter = CTFramesetterCreateWithAttributedString(attr)
    let suggest = CTFramesetterSuggestFrameSizeWithConstraints(framesetter, CFRange(location: 0, length: attr.length), nil, CGSize(width: maxWidth, height: 800), nil)
    let rect = CGRect(x: point.x, y: point.y - suggest.height, width: maxWidth, height: suggest.height)
    let path = CGPath(rect: rect, transform: nil)
    let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: 0, length: attr.length), path, nil)
    ctx.saveGState()
    CTFrameDraw(frame, ctx)
    ctx.restoreGState()
    return suggest.height
}

func render(scene: Scene, cgImage: CGImage?, progress: CGFloat) -> CGImage {
    let cs = CGColorSpaceCreateDeviceRGB()
    let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    ctx.setFillColor(color(0.04, 0.06, 0.12))
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))

    let captionH: CGFloat = scene.image == nil ? 0 : 230
    if scene.image != nil {
        ctx.setFillColor(color(0.07, 0.09, 0.16))
        ctx.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: captionH))
        ctx.setFillColor(color(0.36, 0.29, 1))
        let barW = CGFloat(width) * progress
        ctx.fill(CGRect(x: 0, y: 0, width: barW, height: 6))
    }

    if let cgImage {
        let area = CGRect(x: 64, y: captionH + 36, width: CGFloat(width) - 128, height: CGFloat(height) - captionH - 72)
        let t = smooth(progress)
        let zoom = scene.zoomStart + (scene.zoomEnd - scene.zoomStart) * t
        let focus = CGPoint(
            x: scene.focusStart.x + (scene.focusEnd.x - scene.focusStart.x) * t,
            y: scene.focusStart.y + (scene.focusEnd.y - scene.focusStart.y) * t
        )
        let imgW = CGFloat(cgImage.width)
        let imgH = CGFloat(cgImage.height)
        let fit = min(area.width / imgW, area.height / imgH)
        let dw = imgW * fit * zoom
        let dh = imgH * fit * zoom
        ctx.saveGState()
        ctx.setShadow(offset: CGSize(width: 0, height: -18), blur: 40, color: color(0, 0, 0, 0.45))
        let card = CGRect(x: area.midX - (imgW * fit) / 2, y: area.midY - (imgH * fit) / 2, width: imgW * fit, height: imgH * fit)
        let cardPath = CGPath(roundedRect: card, cornerWidth: 18, cornerHeight: 18, transform: nil)
        ctx.addPath(cardPath)
        ctx.setFillColor(color(1, 1, 1))
        ctx.fillPath()
        ctx.restoreGState()
        ctx.saveGState()
        ctx.addPath(cardPath)
        ctx.clip()
        let dx = area.midX - focus.x * dw
        let dy = area.midY - (1 - focus.y) * dh
        ctx.interpolationQuality = .high
        ctx.draw(cgImage, in: CGRect(x: dx, y: dy, width: dw, height: dh))
        ctx.restoreGState()
    }

    let titleFont = NSFont.systemFont(ofSize: scene.image == nil ? 72 : 40, weight: .bold)
    let bodyFont = NSFont.systemFont(ofSize: scene.image == nil ? 28 : 24, weight: .regular)
    let kickerFont = NSFont.systemFont(ofSize: 18, weight: .semibold)

    if scene.image == nil {
        let blockW: CGFloat = 1400
        let x = (CGFloat(width) - blockW) / 2
        var y = CGFloat(height) * 0.62
        _ = drawText(scene.kicker, font: kickerFont, color: color(0.62, 0.58, 1), in: ctx, at: CGPoint(x: x, y: y), maxWidth: blockW)
        y -= 36
        let titleH = drawText(scene.title, font: titleFont, color: color(1, 1, 1), in: ctx, at: CGPoint(x: x, y: y), maxWidth: blockW)
        y -= titleH + 28
        for line in scene.lines {
            let h = drawText(line, font: bodyFont, color: color(0.75, 0.78, 0.86), in: ctx, at: CGPoint(x: x, y: y), maxWidth: blockW)
            y -= h + 10
        }
    } else {
        var y: CGFloat = captionH - 28
        let h1 = drawText(scene.kicker, font: kickerFont, color: color(0.62, 0.58, 1), in: ctx, at: CGPoint(x: 72, y: y), maxWidth: 1700)
        y -= h1 + 14
        let h2 = drawText(scene.title, font: titleFont, color: color(1, 1, 1), in: ctx, at: CGPoint(x: 72, y: y), maxWidth: 1760)
        y -= h2 + 12
        for line in scene.lines {
            let h = drawText(line, font: bodyFont, color: color(0.78, 0.82, 0.9), in: ctx, at: CGPoint(x: 72, y: y), maxWidth: 1760)
            y -= h + 6
        }
    }
    return ctx.makeImage()!
}

func makeBuffer(from image: CGImage, pool: CVPixelBufferPool) -> CVPixelBuffer? {
    var buffer: CVPixelBuffer?
    let status = CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &buffer)
    guard status == kCVReturnSuccess, let buffer else { return nil }
    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
    let bytes = CVPixelBufferGetBytesPerRow(buffer)
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: base, width: width, height: height, bitsPerComponent: 8, bytesPerRow: bytes, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) else { return nil }
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return buffer
}

let cache = Dictionary(uniqueKeysWithValues: Set(scenes.compactMap(\.image)).map { ($0, loadCG($0)) })
for (path, image) in cache where image == nil {
    fputs("Missing image: \(path)\n", stderr)
    exit(1)
}

try? FileManager.default.removeItem(at: output)
let writer = try AVAssetWriter(outputURL: output, fileType: .mp4)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 7_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
])
writer.add(input)
guard writer.startWriting() else {
    fputs("Cannot start writing: \(writer.error?.localizedDescription ?? "")\n", stderr)
    exit(1)
}
writer.startSession(atSourceTime: .zero)
guard let pool = adaptor.pixelBufferPool else {
    fputs("No pixel buffer pool\n", stderr)
    exit(1)
}

var frameIndex = 0
for scene in scenes {
    let count = max(1, Int((scene.seconds * Double(fps)).rounded()))
    let cg = scene.image.flatMap { cache[$0] ?? nil }
    for i in 0..<count {
        let progress = count == 1 ? 1 : CGFloat(i) / CGFloat(count - 1)
        let rendered = render(scene: scene, cgImage: cg, progress: progress)
        while !input.isReadyForMoreMediaData {
            Thread.sleep(forTimeInterval: 0.002)
        }
        guard let buffer = makeBuffer(from: rendered, pool: pool) else {
            fputs("Buffer failed at frame \(frameIndex)\n", stderr)
            exit(1)
        }
        let time = CMTime(value: CMTimeValue(frameIndex), timescale: fps)
        if !adaptor.append(buffer, withPresentationTime: time) {
            fputs("Append failed: \(writer.error?.localizedDescription ?? "")\n", stderr)
            exit(1)
        }
        frameIndex += 1
    }
    fputs("scene \(scene.kicker) \(count) frames\n", stderr)
}

input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
if writer.status != .completed {
    fputs("Export failed: \(writer.error?.localizedDescription ?? "")\n", stderr)
    exit(1)
}
let seconds = Double(frameIndex) / Double(fps)
fputs(String(format: "Wrote %@ (%.1f s, %d frames)\n", output.path, seconds, frameIndex), stderr)
