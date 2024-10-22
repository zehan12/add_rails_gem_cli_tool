#!/usr/bin/env node

const fs = require("fs");
const { exec } = require("child_process");
const axios = require("axios");

async function fetchGemInfo(gemName) {
    try {
        const response = await axios.get(
            `https://rubygems.org/api/v1/gems/${gemName}.json`
        );
        return response.data;
    } catch (error) {
        if (error.response) {
            if (error.response.status === 404) {
                console.error(`Gem '${gemName}' not found on RubyGems.`);
            } else {
                console.error(
                    `Error fetching gem info: ${error.response.status} - ${error.response.statusText}`
                );
            }
        } else {
            console.error(`Error fetching gem info: ${error.message}`);
        }
        return null;
    }
}

function parseGemSpec(gemSpec) {
    const regex = /gem\s*["']([^"']+)["'],?\s*["']([^"']+)["'],?\s*["']([^"']+)["']?/;
    const match = gemSpec.match(regex);

    if (match) {
        const gemName = match[1];
        const versionConstraints = [match[2], match[3]].filter(Boolean); // Filter out any undefined values
        return { gemName, versionConstraints };
    } else {
        // Try to parse a simpler format without the 'gem' keyword
        const simpleRegex = /([^,]+),?\s*["']([^"']+)["'],?\s*["']([^"']+)["']?/;
        const simpleMatch = gemSpec.match(simpleRegex);

        if (simpleMatch) {
            const gemName = simpleMatch[1].trim();
            const versionConstraints = [simpleMatch[2], simpleMatch[3]].filter(Boolean);
            return { gemName, versionConstraints };
        }
    }

    return null;
}

async function addGem(gemSpec) {
    const gemfilePath = "Gemfile";

    if (!fs.existsSync(gemfilePath)) {
        console.error("Gemfile not found in the current directory.");
        process.exit(1);
    }

    let gemfileContent = fs.readFileSync(gemfilePath, "utf8");

    const parsedSpec = parseGemSpec(gemSpec);
    if (!parsedSpec) {
        console.error(`Invalid gem specification: '${gemSpec}'.`);
        return;
    }

    const { gemName, versionConstraints } = parsedSpec;

    if (gemfileContent.includes(gemName)) {
        console.log(`Gem '${gemName}' is already in the Gemfile.`);
        return; // Skip to the next gem
    }

    const gemInfo = await fetchGemInfo(gemName);
    if (gemInfo) {
        let gemEntry = `gem '${gemName}'`;
        if (versionConstraints.length > 0) {
            gemEntry += `, ${versionConstraints.map(v => `"${v}"`).join(', ')}`;
        }

        const gemComment = `# Added ${gemInfo.name}${gemInfo.description ? ": " + gemInfo.description : ""}`;

        fs.appendFileSync(gemfilePath, `\n${gemComment}\n${gemEntry}\n`);
        console.log(`Gem '${gemName}' added to Gemfile.`);
    } else {
        console.error(`Could not retrieve information for gem '${gemName}'. Please check the gem name.`);
    }
}

if (process.argv.length < 3) {
    console.log("Usage: node add_gem.js 'gem \"gem_name\", \"version1\", \"version2\"' or 'gem_name, \"version1\", \"version2\"'");
    process.exit(1);
}

const gemSpecs = process.argv.slice(2);

(async () => {
    for (const gemSpec of gemSpecs) {
        await addGem(gemSpec);
    }

    console.log("Running 'bundle install'...");
    exec("bundle install", (error, stdout, stderr) => {
        if (error) {
            console.error(`Error during bundle install: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
        }
        console.log(stdout);
    });
})();
