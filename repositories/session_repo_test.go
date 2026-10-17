package repositories

import (
	"errors"
	"testing"
)

func TestCommitInBatches(t *testing.T) {
	items := make([]int, 1003)
	var sizes []int
	err := commitInBatches(items, batchDeleteLimit, func(chunk []int) error {
		sizes = append(sizes, len(chunk))
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(sizes) != 3 || sizes[0] != 400 || sizes[1] != 400 || sizes[2] != 203 {
		t.Fatalf("unexpected chunking: %v", sizes)
	}

	calls := 0
	err = commitInBatches(items, 500, func([]int) error { calls++; return errors.New("boom") })
	if err == nil || calls != 1 {
		t.Fatalf("expected stop on first error, calls=%d err=%v", calls, err)
	}

	if err := commitInBatches([]int{}, 10, func([]int) error { t.Fatal("no call expected"); return nil }); err != nil {
		t.Fatal(err)
	}
}
