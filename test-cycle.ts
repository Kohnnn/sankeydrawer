
import { parseDSL } from './app/src/lib/dsl-parser';

// Test 1: Simple Cycle (A -> B -> A)
const cycle1 = `A [10] B
B [10] A`;

// Test 2: Longer Cycle (A -> B -> C -> A)
const cycle2 = `A [10] B
B [10] C
C [10] A`;

// Test 3: Valid Branching (A -> B, A -> C)
const valid = `A [10] B
A [10] C`;

// Test 4: Duplicates (A -> B twice)
const duplicates = `A [10] B
A [20] B`;

function runTest(name: string, input: string) {
    console.log(`\n--- ${name} ---`);
    const result = parseDSL(input);
    if (!result) {
        console.log("Result: NULL");
        return;
    }
    console.log(`Links: ${result.links.length}`);
    result.links.forEach(l => {
        // resolve IDs back to name for clarity in log (though parser might return ID)
        // Mocking resolution if needed, but IDs are likely "a", "b"
        console.log(`  ${l.source} -> ${l.target} : ${l.value}`);
    });
}

// Rewriting parseDSL for test environment (mocking unavailable imports)
// or relying on ts-node to run the actual file if imports work.
// Since dsl-parser imports '@/types/sankey', ts-node might fail with alias.
// We must use the replace_file trick from before to make it standalone OR fix tsconfig paths.
// Let's try running as is, and if it fails, I'll inline the parser again.
