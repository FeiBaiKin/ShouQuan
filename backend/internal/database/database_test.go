package database

import (
	"fmt"
	"os"
	"strconv"
	"testing"

	"authcenter/backend/internal/config"
)

type testSQLStateError struct {
	state string
}

func (e *testSQLStateError) Error() string {
	return "postgres error"
}

func (e *testSQLStateError) SQLState() string {
	return e.state
}

func TestQuotePostgresIdentifier(t *testing.T) {
	if got, want := quotePostgresIdentifier(`auth"center`), `"auth""center"`; got != want {
		t.Fatalf("quotePostgresIdentifier() = %q, want %q", got, want)
	}
}

func TestHasSQLState(t *testing.T) {
	err := fmt.Errorf("connect failed: %w", &testSQLStateError{state: "3D000"})
	if !hasSQLState(err, "3D000") {
		t.Fatal("wrapped SQLSTATE was not detected")
	}
	if hasSQLState(err, "42P04") {
		t.Fatal("mismatched SQLSTATE was detected")
	}
	if hasSQLState(fmt.Errorf("plain error"), "3D000") {
		t.Fatal("plain error reported a SQLSTATE")
	}
}

func TestPostgresIntegration(t *testing.T) {
	if os.Getenv("AUTHCENTER_POSTGRES_INTEGRATION") != "1" {
		t.Skip("set AUTHCENTER_POSTGRES_INTEGRATION=1 to run against PostgreSQL")
	}
	password := os.Getenv("PGPASSWORD")
	if password == "" {
		t.Fatal("PGPASSWORD is required for the PostgreSQL integration test")
	}
	port, err := strconv.Atoi(envOrDefault("PGPORT", "5432"))
	if err != nil {
		t.Fatalf("invalid PGPORT: %v", err)
	}

	cfg := &config.Config{
		Database: config.DatabaseConfig{
			Host:          envOrDefault("PGHOST", "127.0.0.1"),
			Port:          port,
			User:          envOrDefault("PGUSER", "postgres"),
			Password:      password,
			Name:          envOrDefault("PGDATABASE", "authcenter"),
			SSLMode:       envOrDefault("PGSSLMODE", "disable"),
			TimeZone:      envOrDefault("PGTZ", "Asia/Shanghai"),
			MaintenanceDB: envOrDefault("PGMAINTENANCE_DB", "postgres"),
			AutoCreate:    true,
		},
		Admin: config.AdminConfig{
			Username: "admin",
			Password: envOrDefault("AUTHCENTER_ADMIN_PASSWORD", "admin123"),
		},
	}
	db, err := Init(cfg)
	if err != nil {
		t.Fatalf("initialize PostgreSQL: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql.DB: %v", err)
	}
	defer sqlDB.Close()

	expectedTables := []string{
		"admins", "products", "licenses", "releases", "heartbeat_logs",
		"license_events", "download_tokens", "settings", "pricing_plans", "purchase_orders",
	}
	var tableCount int64
	if err := db.Raw(
		"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ?",
		expectedTables,
	).Scan(&tableCount).Error; err != nil {
		t.Fatalf("count migrated tables: %v", err)
	}
	if tableCount != int64(len(expectedTables)) {
		t.Fatalf("migrated table count = %d, want %d", tableCount, len(expectedTables))
	}
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
