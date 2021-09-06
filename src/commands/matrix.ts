import { gitlogPromise } from "gitlog";
import { isEqual, parseISO } from "date-fns";
import fs from "fs";
import { markdownTable } from "markdown-table";
import { getContributors } from "../contributors.js";
import { dirname } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

const __dirname = dirname(fileURLToPath(import.meta.url));

const outputMarkdownTable = (table: Record<string, Record<string, number>>) => {
  const matrix = [["", ...Object.keys(table)]];

  Object.keys(table).forEach((contributor, cIndex) => {
    let row = [contributor];

    Object.keys(table[contributor]).forEach((pair, pIndex) => {
      if (pIndex < cIndex) {
        row.push(table[contributor][pair].toString());
      } else {
        row.push("");
      }
    });
    matrix.push(row);
  });

  return markdownTable(matrix);
};

export const matrix = async ({ after }: { after: string }) => {
  const CO_AUTHORS = "Co-authors: ";

  interface PairData {
    count: number;
    lastPair: Date | -1;
  }

  interface PairPartners {
    [key: string]: PairData;
  }

  const matrix: Record<string, PairPartners> = {};

  const contributors = getContributors();

  contributors.forEach((contributor) => {
    matrix[contributor] = {};
    contributors
      .filter((pair) => pair !== contributor)
      .forEach((pair) => {
        matrix[contributor][pair] = { count: 0, lastPair: -1 };
      });
  });

  const options = {
    repo: __dirname,
    number: 500,
    after,
    fields: ["hash", "authorName", "authorDate", "body"] as const,
  };

  try {
    const commits = await gitlogPromise(options);
    const pairingHistory = commits
      .filter(
        (commit) =>
          commit.body.includes(CO_AUTHORS) && commit.body.split(CO_AUTHORS)[1]
      )
      .flatMap(({ authorName, body, authorDate, hash }) => {
        const pairs = body
          .split(CO_AUTHORS)[1]
          .replace(/\n/g, " ")
          .trim()
          .split(", ");
        return pairs.map((pair) => {
          return { authorName, authorDate, pair, hash };
        });
      });

    const warnings: string[] = [];

    pairingHistory.forEach(({ authorName, pair, hash, authorDate }) => {
      if (authorName === pair) {
        warnings.push(
          `Don't include yourself in the "${CO_AUTHORS}" line, ${authorName}. See commit ${hash}`
        );
        return;
      }
      if (!(authorName in matrix)) {
        warnings.push(
          `${authorName} is not a known contributor. See commit ${hash}`
        );
        return;
      }
      if (!(pair in matrix)) {
        warnings.push(`${pair} is not a known contributor. See commit ${hash}`);
        return;
      }

      const date = parseISO(authorDate.split(" ")[0]);
      if (!isEqual(matrix[authorName][pair].lastPair, date)) {
        matrix[authorName][pair].count += 1;
        matrix[pair][authorName].count += 1;
      }

      matrix[authorName][pair].lastPair = date;
      matrix[pair][authorName].lastPair = date;
    });

    warnings.forEach((warning) => console.warn(warning));

    const table: Record<string, Record<string, number>> = {};

    for (const [contributor, pairs] of Object.entries(matrix)) {
      table[contributor] = {};
      for (const [pair, stats] of Object.entries(pairs)) {
        table[contributor][pair] = stats.count;
      }
    }

    fs.writeFileSync("./.pear/matrix.md", outputMarkdownTable(table), {
      encoding: "utf-8",
    });
  } catch (error) {
    console.error(chalk.redBright(error));
    console.error(
      chalk.redBright(
        "Sorry, we were unable to generate a pairing matrix for your team."
      )
    );
  }
};
