from pipeline.main import process_report


TEST_CASES = [
    {
        "text": "Hamare gaon mein road bahut kharab hai",
        "expect_category": "road"
    },

    {
        "text": "बारिश में सड़क बंद हो जाती है",
        "expect_category": "road"
    },

    {
        "text": "आमच्या गावात पाणी नाही",
        "expect_category": "water"
    },

    {
        "text": "The road connecting our village to the highway is unusable",
        "expect_category": "road"
    },

    {
        "text": "hospital bahut door hai",
        "expect_category": "health"
    }
]


def run_tests(gazetteer_rows):

    passed = 0

    for case in TEST_CASES:

        result = process_report(
            {"text": case["text"]},
            gazetteer_rows
        )

        ok = (
            result["issue_category"]
            == case["expect_category"]
        )

        if ok:
            passed += 1
            status = "PASS"
        else:
            status = "FAIL"

        print(
            f"{status}: "
            f"{case['text'][:45]!r} "
            f"-> {result['issue_category']}"
        )

    print(
        f"\n{passed}/{len(TEST_CASES)} passed"
    )


if __name__ == "__main__":

    run_tests(
        gazetteer_rows=[]
    )