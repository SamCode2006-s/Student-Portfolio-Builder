const statusMessage = document.getElementById("statusMessage");
const fileInput = document.getElementById("fileInput");
const documentPreview = document.getElementById("documentPreview");
const themeButtons = document.querySelectorAll(".theme-button");
const shareProfileButton = document.getElementById("shareProfileButton");

const profileFields = {
    name: document.getElementById("name"),
    prn: document.getElementById("prn"),
    dob: document.getElementById("dob"),
    about: document.getElementById("about"),
    mail: document.getElementById("mail"),
    phone: document.getElementById("phone"),
    github: document.getElementById("github"),
    linkedin: document.getElementById("linkedin")
};

const listFields = {
    skillList: document.getElementById("skillList"),
    certList: document.getElementById("certList"),
    projectList: document.getElementById("projectList")
};

const defaultText = {
    name: "Name: -",
    prn: "PRN: -",
    dob: "DOB: -",
    about: "Upload a document to extract and display the summary here.",
    mail: "Email: -",
    phone: "Phone: -",
    github: "GitHub: -",
    linkedin: "LinkedIn: -"
};

let currentPortfolioData = null;

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js";
}

function sanitizeText(value) {
    return value.replace(/\r/g, "").trim();
}

function normaliseText(text) {
    return sanitizeText(text)
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n");
}

function updateStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? "#b42318" : "";
}

function resetPortfolio() {
    Object.entries(defaultText).forEach(([key, value]) => {
        profileFields[key].textContent = value;
    });

    Object.values(listFields).forEach((list) => {
        list.innerHTML = "";
    });

    documentPreview.textContent = "Your extracted text will appear here.";
    currentPortfolioData = null;
    shareProfileButton.disabled = true;
}

function setTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    themeButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.theme === theme);
    });
}

function setParagraphValue(element, label, value) {
    element.textContent = value ? `${label}: ${value}` : `${label}: -`;
}

function setLinkValue(element, label, value) {
    if (!value) {
        element.textContent = `${label}: -`;
        return;
    }

    element.innerHTML = `${label}: <a href="${value}" target="_blank" rel="noreferrer">${value}</a>`;
}

function extractSingleValue(lines, keyword) {
    const exactPattern = new RegExp(`^${keyword}\\s*[:|-]\\s*(.+)$`, "i");
    const inlinePattern = new RegExp(`${keyword}\\s*[:|-]\\s*(.+)`, "i");

    for (const line of lines) {
        const exactMatch = line.match(exactPattern);
        if (exactMatch) {
            return exactMatch[1].trim();
        }
    }

    for (const line of lines) {
        const inlineMatch = line.match(inlinePattern);
        if (inlineMatch) {
            return inlineMatch[1].trim();
        }
    }

    return "";
}

function getSectionLines(lines, sectionName, stopSections) {
    const collected = [];
    let inSection = false;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            continue;
        }

        const lowerLine = line.toLowerCase();
        if (lowerLine.startsWith(sectionName.toLowerCase())) {
            inSection = true;
            continue;
        }

        if (inSection && stopSections.some((stop) => lowerLine.startsWith(stop.toLowerCase()))) {
            break;
        }

        if (inSection) {
            collected.push(line);
        }
    }

    return collected;
}

function parseDocument(text) {
    const lines = normaliseText(text)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const skillsValue = extractSingleValue(lines, "Skills");
    const skillItems = skillsValue
        ? skillsValue.split(/[,;]+/).map((item) => item.trim()).filter(Boolean)
        : [];

    const certificateLines = getSectionLines(lines, "Certificates", [
        "Projects",
        "Links",
        "Skills",
        "Email",
        "Phone",
        "GitHub",
        "LinkedIn"
    ]);

    const projectLines = getSectionLines(lines, "Projects", [
        "Links",
        "Certificates",
        "Skills",
        "Email",
        "Phone",
        "GitHub",
        "LinkedIn"
    ]);

    return {
        name: extractSingleValue(lines, "Name"),
        prn: extractSingleValue(lines, "PRN"),
        dob: extractSingleValue(lines, "DOB"),
        about: extractSingleValue(lines, "About"),
        email: extractSingleValue(lines, "Email"),
        phone: extractSingleValue(lines, "Phone"),
        github: extractSingleValue(lines, "GitHub"),
        linkedin: extractSingleValue(lines, "LinkedIn"),
        skills: skillItems,
        certificates: certificateLines,
        projects: projectLines
    };
}

function fillList(listElement, items, formatter) {
    listElement.innerHTML = "";

    if (!items.length) {
        const li = document.createElement("li");
        li.textContent = "No data found in the uploaded document.";
        listElement.appendChild(li);
        return;
    }

    items.forEach((item) => {
        const li = document.createElement("li");
        formatter(li, item);
        listElement.appendChild(li);
    });
}

function populatePortfolio(parsed, sourceText) {
    setParagraphValue(profileFields.name, "Name", parsed.name);
    setParagraphValue(profileFields.prn, "PRN", parsed.prn);
    setParagraphValue(profileFields.dob, "DOB", parsed.dob);
    profileFields.about.textContent = parsed.about || defaultText.about;
    setParagraphValue(profileFields.mail, "Email", parsed.email);
    setParagraphValue(profileFields.phone, "Phone", parsed.phone);
    setLinkValue(profileFields.github, "GitHub", parsed.github);
    setLinkValue(profileFields.linkedin, "LinkedIn", parsed.linkedin);

    fillList(listFields.skillList, parsed.skills, (li, item) => {
        li.textContent = item;
    });

    fillList(listFields.certList, parsed.certificates, (li, item) => {
        const [title, link] = item.split("|").map((part) => part.trim());
        if (link) {
            li.innerHTML = `<a href="${link}" target="_blank" rel="noreferrer">${title}</a>`;
            return;
        }
        li.textContent = title || item;
    });

    fillList(listFields.projectList, parsed.projects, (li, item) => {
        const [title, description] = item.split("|").map((part) => part.trim());
        li.textContent = description ? `${title}: ${description}` : title || item;
    });

    documentPreview.textContent = normaliseText(sourceText) || "No text could be extracted.";
    currentPortfolioData = parsed;
    shareProfileButton.disabled = false;
}

function encodeProfileData(parsed, sourceText) {
    return btoa(unescape(encodeURIComponent(JSON.stringify({
        parsed,
        sourceText: normaliseText(sourceText)
    }))));
}

function decodeProfileData(value) {
    return JSON.parse(decodeURIComponent(escape(atob(value))));
}

async function generateProfileLink() {
    if (!currentPortfolioData) {
        updateStatus("Upload a document before generating a profile link.", true);
        return;
    }

    try {
        const encoded = encodeProfileData(currentPortfolioData, documentPreview.textContent);
        const shareUrl = `${window.location.origin}${window.location.pathname}#profile=${encoded}`;

        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(shareUrl);
            updateStatus("Profile link generated and copied to clipboard.");
        } else {
            updateStatus(`Profile link generated: ${shareUrl}`);
        }

        window.history.replaceState(null, "", `#profile=${encoded}`);
    } catch (error) {
        updateStatus("Could not generate the profile link.", true);
    }
}

async function readTxtFile(file) {
    return file.text();
}

function getTextFromPdfPage(textItems) {
    const lines = [];

    textItems.forEach((item) => {
        const text = item.str.trim();

        if (!text) {
            return;
        }

        const xPosition = item.transform[4];
        const yPosition = Math.round(item.transform[5]);
        let matchingLine = lines.find((line) => Math.abs(line.y - yPosition) <= 3);

        if (!matchingLine) {
            matchingLine = {
                y: yPosition,
                words: []
            };
            lines.push(matchingLine);
        }

        matchingLine.words.push({
            x: xPosition,
            text
        });
    });

    return lines
        .sort((firstLine, secondLine) => secondLine.y - firstLine.y)
        .map((line) => {
            return line.words
                .sort((firstWord, secondWord) => firstWord.x - secondWord.x)
                .map((word) => word.text)
                .join(" ");
        })
        .join("\n");
}

async function readPdfFile(file) {
    if (!window.pdfjsLib) {
        throw new Error("PDF parser is not available.");
    }

    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = getTextFromPdfPage(content.items);
        pages.push(pageText);
    }

    return pages.join("\n");
}

async function extractTextFromFile(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    if (extension === "txt") {
        return readTxtFile(file);
    }

    if (extension === "pdf") {
        return readPdfFile(file);
    }

    throw new Error("Unsupported file type. Please upload a TXT or PDF file.");
}

fileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    updateStatus(`Reading ${file.name}...`);

    try {
        const extractedText = await extractTextFromFile(file);
        const parsed = parseDocument(extractedText);
        populatePortfolio(parsed, extractedText);
        updateStatus(`Loaded ${file.name} successfully.`);
    } catch (error) {
        resetPortfolio();
        updateStatus(error.message || "Could not read the uploaded document.", true);
    }
});

themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        setTheme(button.dataset.theme);
    });
});

setTheme("light");
resetPortfolio();
shareProfileButton.addEventListener("click", generateProfileLink);

try {
    const hash = window.location.hash;
    if (hash.startsWith("#profile=")) {
        const payload = decodeProfileData(hash.slice("#profile=".length));
        if (payload && payload.parsed) {
            populatePortfolio(payload.parsed, payload.sourceText || "");
            updateStatus("Profile loaded from shared link.");
        }
    }
} catch (error) {
    updateStatus("The shared profile link is invalid or corrupted.", true);
}
