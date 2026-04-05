# The Genome Project: A Generative Anti-Tool

## 1. Theoretical Framework: From Tool to Organism

Conventional software operates as a set of rigid, deterministic **tools**. They impose a pre-defined structure on creativity, subtly shaping thought and action to fit their own internal logic. This project challenges that paradigm.

We posit that software can be a form of **ontological violence**, confining the user within a narrow, commercially-defined reality. The Genome Project is an attempt to build an **anti-tool**—a system that does not dictate but rather *enables*; one that fosters emergence instead of enforcing control. It treats content not as a static artifact to be built, but as a living **organism** to be cultivated.

By representing information as a **genome**, we shift the creative process from mechanical assembly to biological evolution. The user becomes a digital geneticist, guiding the development of ideas through mutation, recombination, and selection.

## 2. The Information Ontology: Codons as Building Blocks

The fundamental unit of this system is the **codon**. Each codon is a discrete packet of information with a specific function. Their sequence forms a genome that can be "expressed" to create a web-based phenotype.

### Core Codon Types & Examples

-   **`TXT` (Text):** The most basic unit of semantic content.
    -   **Example:** A `TXT` codon with the payload `"The quick brown fox..."` renders as a simple paragraph. Multiple `TXT` codons create a flowing narrative.

-   **`HDR` (Header):** Defines a section heading, providing structure.
    -   **Example:** An `HDR` with payload `"Chapter 1: The Awakening"` creates an `<h2>` tag, organizing the content that follows.

-   **`LNK` (Hyperlink):** Connects the genome to external information.
    -   **Example:** A `LNK` with payload `"https://example.com"` and a user-defined label `"Visit Example"` renders as `<a href="https://example.com">Visit Example</a>`.

-   **`BRK` (Line Break):** Inserts a simple horizontal rule or break.
    -   **Example:** Placing a `BRK` codon between two `TXT` codons creates a visual separation, like a `<hr>` tag.

### Media Codon Types

These codons embed rich media, which can be loaded from external URLs or uploaded directly as base64-encoded data URLs.

-   **`IMG` (Image):** Renders an image.
    -   **Example:** An `IMG` codon with the payload `"data:image/png;base64,iVBORw0KGgo..."` embeds an image directly into the phenotype without external dependencies.

-   **`VID` (Video) & `AUC` (Audio):** Embed playable media.
    -   **Example:** A `VID` codon can point to a `.mp4` file or a YouTube embed link, rendering a video player in the phenotype.

### Functional (Genetic) Codon Types

These codons do not produce visible content themselves but alter the *entire expressed phenotype*.

-   **`STY` (Style):** Contains a block of CSS code. All `STY` codons are aggregated and injected into a `<style>` tag in the phenotype's `<head>`.
    -   **Example:** A `STY` codon with payload `"body { background-color: #111; color: #eee; } h2 { border-bottom: 1px solid #555; }"` creates a dark mode theme for the expressed page.

-   **`CDE` (Code):** Contains a block of JavaScript. All `CDE` codons are aggregated and injected into a `<script>` tag at the end of the phenotype's `<body>`.
    -   **Example:** A `CDE` codon with payload `"document.querySelectorAll('img').forEach(img => img.style.filter = 'grayscale(100%)');"` would make all images on the expressed page black and white.

### Genetic Control: Introns vs. Exons

Every codon can be toggled between two states:
-   **Exon (Expressed):** The codon is active and will be included in the final phenotype.
-   **Intron (Dormant):** The codon is ignored during expression. This is the system's form of "junk DNA."

**Use Case:** Instead of deleting an idea, you can turn its codons into introns. The information remains part of the genome's history and potential future, available to be reactivated later. This allows for non-destructive editing and versioning.

## 3. Key Features & Interfaces

-   **`gg2-mega.html`:** The primary, feature-rich interface for editing, expressing, and publishing genomes.
-   **`gg2-upgrade.html`:** A staging ground for testing new UI features, like the draggable panel resizer.
-   **Recombination Lab:** Splice genes from two parent genomes to create novel offspring.
-   **Publishing:** Export a fully self-contained, interactive HTML file of your expressed phenotype.

## 4. How to Run

1.  No complex build process is needed. This project is a set of static HTML/CSS/JS files.
2.  To run locally, start a simple web server from the project's root directory:
    ```bash
    python3 -m http.server
    ```
3.  Open your browser and navigate to `http://localhost:8000/ggg-welcome.html` to begin.
