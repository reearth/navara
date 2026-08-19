# Making Maps Readable: A Dive into Font Rendering in Navara


---

## 1. Introduction — 2 minutes
### _Slide 1_
### _Slide 2_

Hello everyone. My name is Adel Refaat, a graphics engineer in Eukarya and a member of the Navara team.

For those who don't know what Navara is,
it is a modern 3d map engine, it is using a headless archtecture , it's core GIS engine is written in Rust , while it's current renderer uses Typescript.

The slides and links are available through this QR code.

Before I Continue, I want to know. How many people here have previously had to render text using for example WebGL or OpenGL, ...? - (justify the crash course) - so a quick crash course might be helpfull -.

### _Slide 3_
Today I want to look at why text inside a map engine is unusually difficult,

A map can place the text label for Cairo at the correct coordinates and still render its name wrong.
Geometric correctness is not enough if the people using the map cannot read it.


so we will look at how some engines solves part of that problem, and how we do text rendering in Navara.

### Transition

But first let us establish why this talk belongs at FOSS4G.

---

## 2. Why a text-rendering talk at FOSS4G? — 3 minutes


### _Slide 4_

Geometry tells us where things are, but text tells us what they mean.

### _Slide 5_ & _Slide 6_
Remove the labels and a technically complete basemap quickly becomes difficult to use.

(Ask the audiance to identify the country in the empty map)
Can someone tell me which country is that ?

### _Slide 7_
At first, map text sounds like normal UI text. We have a string, a font, a size, and a color. But the constraints are very different.

A UI might have dozens of mostly static strings. A map can have thousands of candidate labels arriving dynamically from vector tiles or GeoJSON, The text is determined by the data, not known when the application is built.

Every time the camera moves, the engine must decide which labels are visible, which are behind the globe, which overlap, and which have sufficient priority to remain on screen.

Maps also place writing systems beside one another in ways that many applications do not. A single global view can contain Latin, Arabic and Japanese.


---
## 3. A crash course in font rendering — 4 minutes

### _Slide 8_
To understand how map engines render Text, we first
need a very quick crash course on text-rendering.


### 3.1 Characters are not glyphs

### _Slide 9_

A string is stored as Unicode. Each chacater has a unique code point. Think of unicode as a big lookup table that maps every character in every language to a unique number.

and that number can be stored in memory using UTF-8 or UTF-16


### _Slide 10_

A Font file is not a folder of images, It contains several connected tables.

The most important ones are:

`cmap`: which maps from unicode points to glyph IDs

`GLYPF`: contains actual outline data for the glyphs 

And many others needed for shaping and positioning.

and The Glyph shape is descriped as a collection of bezier curves
which basicly is a curve with 2 ends and one or two control points (depends on the file format)


## _Slide 11_

So given the text and the font, the shaper will output the glyph ids and the positions for each character in the text.


A shaping engine needs these tables together. If the client
only has a collection of pre-rendered glyph images, it can't do proper shaping for complex scripts.


A glyph is a font-specific visual form. The relationship between characters and glyphs is not necessarily one-to-one.

Several characters can become one glyph through a ligature. One character can have different glyphs depending on its neighbours. 

Arabic makes this distinction immediately visible. A letter changes shape depending on whether it is isolated or connected to letters before and after it.

So selecting one bitmap for each input code point is not enough to produce the correct word.


### 3.3 How can we draw a shaped glyph?



### _Slide 12_

After shaping gives us glyph IDs and positions, we still need something the GPU can draw.

One option is a normal bitmap. It is simple, but a bitmap generated for one size becomes blurry or pixelated when scaled.

Another option is vector rendering: triangulate the glyph outline, or evaluate its curves on the GPU. This can be very sharp, but it makes geometry and shader work more complicated.

The common map-engine compromise is a **signed distance field**, or SDF.

Instead of storing only whether each pixel is inside or outside the glyph, the texture stores its distance from the glyph outline. The shader then uses this texture to draw the character in any size.

And as a form of caching, we can pack these rendered glyphs into a bigger texture, called an Atlas, so we don't have to re-render the same glyph everytime we need it.

---

## 4. Text rendering in established map engines — 4 minutes

### _Slide 13_

After this quick crash course, we can examine the pipeline used by many web map engines.


The established web-map approach separates font processing from map rendering.


### _Slide 14_

Before the application runs, a server rasterizes glyphs into SDF images and packages them into Protocol Buffer files.

The glyph files are normally divided into ranges of 256 Unicode code points.

At runtime, the engine examines the label text and requests the ranges it
needs. It parses each PBF response, packs the supplied glyph images into an atlas, and uses the included metrics to position the glyph quads.


### _Slide 15_
This was —and remains— a clever engineering trade-off.

### Advantages

- Client CPU cost is low because the rasterization has already
  happened.
- The engine does not need a complete font parser and rasterizer.
- Range files cache well on a CDN.
- The approach was practical on older browsers and mobile devices.

### Limitations

### _Slide 16_

However, this means the client no longer has the original font. A typical glyph PBF contains SDF images and basic metrics, but not all of the OpenType tables a general shaping engine needs.

That doesn't mean rendering RTL text like arabic impossible. It means the PBF glyph resource is not sufficient on its own for complete, font-aware shaping.

Engines need another mechanism, separate font information, or script-specific preprocessing.

Historically, RTL text have often required
special handling or plugins.

### _Slide 17_
There are operational costs as well:

  - Every custom font must be processed and made available through a server before it can be used.

  - the Client might get more data than it needs in the requested range

  - Extra plugings for RTL scripts

### Transition

Navara's answer was to bring the real font back to the client from the start.

---

## 5. The Navara approach — 6 minutes


### _Slide 18_
  Navara has moved away from the Glyph server archtecture, and decided to move it to the client.


### _Slide 19_

This slide explains the Navara architecture for bringing the real font to the client.
The process starts with the label, which is the text that needs to be rendered.
Next, the lazy font step uses a WOFF2 font face to load font data efficiently.
A worker written in Rust and WebAssembly handles the shaping process.
The shaping step generates the glyph run, producing only the glyphs needed for the label.
Finally, the glyphs are placed on demand into an atlas and rendered as GPU instances.

Navara still uses distance fields but changes where they are produced.


### 5.1 Loading font faces only when they are needed
### _Slide 20_
The Navara application registers either a direct font-file URL or a font
family. A family can be constructed from ordinary CSS `@font-face` rules and
their `unicode-range` declarations.

Suppose the map initially shows Latin labels. Navara can fetch only the Latin
face. When an Arabic label appears, it fetches the Arabic face. Moving to Japan can fetch only the relevant Japanese subsets rather than one monolithic global font.

The useful combination is WOFF2 compression plus font faces loaded through Unicode ranges.



### _Slide 21_
### 5.2 Moving the heavy work away from the main thread

The font bytes are transferred to a dedicated Web Worker. Inside that worker,
a Rust module compiled to WebAssembly decompresses the font file when needed,
parses the font, shapes text, rasterizes glyphs, and manages the atlas.

Shaping a cached word is inexpensive, but loading a font and generating many new distance fields can be noticeable.

Doing it in a worker prevents that first-use cost from blocking camera interaction and the
main rendering loop.

Shaped results are cached because repeated labels should not be shaped again unnecessarily.

### _Slide 22_
### 5.3 Shape first, rasterize second

Navara uses `rustybuzz`, a Rust port of HarfBuzz, to shape each text run. The
result is not another string. It is a list of font-specific glyph IDs, advances,
and offsets.

Only after receiving those glyph IDs does Navara check the atlas. Glyphs that
are already present are reused. Missing glyphs are rasterized on demand.

### _Slide 23_

### Transition

This design removes the glyph-server dependency, but it does not remove cost.
It moves cost and responsibility to a different part of the system.

---

## 6. Trade-offs and lessons learned — 2 minutes

### _Slide 24_

### Speaker draft

### Advantages of Navara's design

- shaping happens at runtime using the actual font.
- Applications can use normal WOFF2, WOFF, TTF, or OTF assets without building
  a PBF glyph service.
- Font faces and large CJK subsets can be loaded lazily by Unicode coverage.
- The worker can generate different distance-field qualities.
- The same architecture can mix monochrome text and supported color glyphs.

### Costs and current boundaries

- The first label using a new face pays font-download, parsing, shaping, and
  glyph-generation costs.
- The client retains font bytes.
- Font loading, worker communication, atlas synchronization, eviction, and GPU
  texture updates add implementation complexity.
- A monolithic global font can be a worse network choice than several PBF
  ranges; good subsetting is still important.

---

## 7. Demo — 4 minutes

 
 Let us see what this looks like in a real map


---

## 8. Q&A — 2 minutes

### _Slide 25_

Thank you. I am happy to take questions.

---
