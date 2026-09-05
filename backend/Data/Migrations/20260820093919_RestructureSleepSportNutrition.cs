using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class RestructureSleepSportNutrition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "exercise_muscles");

            migrationBuilder.DropTable(
                name: "exercise_rest_preferences");

            migrationBuilder.DropTable(
                name: "meal_entries");

            migrationBuilder.Sql("DROP TABLE IF EXISTS routine_exercises;");

            migrationBuilder.DropTable(
                name: "workout_sets");

            migrationBuilder.DropTable(
                name: "muscle_groups");

            migrationBuilder.DropTable(
                name: "food_items");

            migrationBuilder.Sql("DROP TABLE IF EXISTS routines;");

            migrationBuilder.DropTable(
                name: "workout_exercises");

            migrationBuilder.DropTable(
                name: "exercises");

            migrationBuilder.DropTable(
                name: "workouts");

            migrationBuilder.DropIndex(
                name: "ix_sleep_entries_user_id",
                table: "sleep_entries");

            migrationBuilder.AddColumn<int>(
                name: "actual_sleep_minutes",
                table: "sleep_entries",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "time_in_bed_minutes",
                table: "sleep_entries",
                type: "integer",
                nullable: true);

            // Carry the existing nights over before the old columns go: time in
            // bed is the span between the two clock times, wrapping midnight.
            // Actual sleep stays empty — it was never recorded and cannot be
            // derived from what we have.
            migrationBuilder.Sql("""
                UPDATE sleep_entries
                SET time_in_bed_minutes = (
                      (EXTRACT(HOUR FROM wake_time)::int * 60 + EXTRACT(MINUTE FROM wake_time)::int)
                    - (EXTRACT(HOUR FROM bed_time)::int * 60 + EXTRACT(MINUTE FROM bed_time)::int)
                    + 1440
                ) % 1440;
                """);

            migrationBuilder.AlterColumn<int>(
                name: "quality",
                table: "sleep_entries",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            // Quality was a 1–5 rating and is now the percentage Sleep Cycle
            // reports, so the old ratings map onto 20/40/60/80/100.
            migrationBuilder.Sql("""
                UPDATE sleep_entries
                SET quality = quality * 20
                WHERE quality BETWEEN 1 AND 5;
                """);

            migrationBuilder.DropColumn(
                name: "bed_time",
                table: "sleep_entries");

            migrationBuilder.DropColumn(
                name: "wake_time",
                table: "sleep_entries");

            migrationBuilder.CreateTable(
                name: "nutrition_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "text", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    kcal = table.Column<int>(type: "integer", nullable: true),
                    protein_g = table.Column<int>(type: "integer", nullable: true),
                    carbs_g = table.Column<int>(type: "integer", nullable: true),
                    fat_g = table.Column<int>(type: "integer", nullable: true),
                    water_l = table.Column<decimal>(type: "numeric", nullable: true),
                    coffee_ml = table.Column<int>(type: "integer", nullable: true),
                    last_coffee = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    logged_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_nutrition_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_nutrition_entries_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "workout_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "text", nullable: false),
                    source = table.Column<string>(type: "text", nullable: false),
                    external_id = table.Column<string>(type: "text", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    duration_minutes = table.Column<int>(type: "integer", nullable: true),
                    exercise_count = table.Column<int>(type: "integer", nullable: false),
                    set_count = table.Column<int>(type: "integer", nullable: false),
                    volume_kg = table.Column<decimal>(type: "numeric", nullable: false),
                    raw_text = table.Column<string>(type: "text", nullable: false),
                    payload_json = table.Column<string>(type: "text", nullable: false),
                    synced_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workout_logs", x => x.id);
                    table.ForeignKey(
                        name: "fk_workout_logs_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_sleep_entries_user_id_date",
                table: "sleep_entries",
                columns: new[] { "user_id", "date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_nutrition_entries_user_id_date",
                table: "nutrition_entries",
                columns: new[] { "user_id", "date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_workout_logs_user_id_source_external_id",
                table: "workout_logs",
                columns: new[] { "user_id", "source", "external_id" },
                unique: true);
        }

        /// <inheritdoc />
        /// <remarks>
        /// Reverting restores the schema but not the data: the sport and food
        /// tables come back empty, and bed and wake times cannot be recovered
        /// from a duration.
        /// </remarks>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "nutrition_entries");

            migrationBuilder.DropTable(
                name: "workout_logs");

            migrationBuilder.DropIndex(
                name: "ix_sleep_entries_user_id_date",
                table: "sleep_entries");

            migrationBuilder.DropColumn(
                name: "actual_sleep_minutes",
                table: "sleep_entries");

            migrationBuilder.DropColumn(
                name: "time_in_bed_minutes",
                table: "sleep_entries");

            migrationBuilder.AlterColumn<int>(
                name: "quality",
                table: "sleep_entries",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "bed_time",
                table: "sleep_entries",
                type: "time without time zone",
                nullable: false,
                defaultValue: new TimeOnly(0, 0, 0));

            migrationBuilder.AddColumn<TimeOnly>(
                name: "wake_time",
                table: "sleep_entries",
                type: "time without time zone",
                nullable: false,
                defaultValue: new TimeOnly(0, 0, 0));

            migrationBuilder.CreateTable(
                name: "exercises",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "text", nullable: true),
                    description = table.Column<string>(type: "text", nullable: true),
                    equipment = table.Column<string>(type: "text", nullable: true),
                    is_custom = table.Column<bool>(type: "boolean", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_exercises", x => x.id);
                    table.ForeignKey(
                        name: "fk_exercises_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "food_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    barcode = table.Column<string>(type: "text", nullable: true),
                    brand = table.Column<string>(type: "text", nullable: true),
                    cached_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    carbs_per100g = table.Column<decimal>(type: "numeric", nullable: false),
                    external_id = table.Column<string>(type: "text", nullable: true),
                    fat_per100g = table.Column<decimal>(type: "numeric", nullable: false),
                    fiber_per100g = table.Column<decimal>(type: "numeric", nullable: true),
                    kcal_per100g = table.Column<decimal>(type: "numeric", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    protein_per100g = table.Column<decimal>(type: "numeric", nullable: false),
                    serving_size_g = table.Column<decimal>(type: "numeric", nullable: true),
                    source = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_food_items", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "muscle_groups",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "text", nullable: false),
                    slug = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_muscle_groups", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "routines",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_routines", x => x.id);
                    table.ForeignKey(
                        name: "fk_routines_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "workouts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    duration_minutes = table.Column<int>(type: "integer", nullable: true),
                    name = table.Column<string>(type: "text", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workouts", x => x.id);
                    table.ForeignKey(
                        name: "fk_workouts_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "exercise_rest_preferences",
                columns: table => new
                {
                    user_id = table.Column<string>(type: "text", nullable: false),
                    exercise_id = table.Column<Guid>(type: "uuid", nullable: false),
                    rest_seconds = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_exercise_rest_preferences", x => new { x.user_id, x.exercise_id });
                    table.ForeignKey(
                        name: "fk_exercise_rest_preferences_exercises_exercise_id",
                        column: x => x.exercise_id,
                        principalTable: "exercises",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_exercise_rest_preferences_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "meal_entries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    food_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "text", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    grams = table.Column<decimal>(type: "numeric", nullable: false),
                    logged_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    meal_type = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_meal_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_meal_entries_food_items_food_item_id",
                        column: x => x.food_item_id,
                        principalTable: "food_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_meal_entries_users_user_id",
                        column: x => x.user_id,
                        principalTable: "AspNetUsers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "exercise_muscles",
                columns: table => new
                {
                    exercise_id = table.Column<Guid>(type: "uuid", nullable: false),
                    muscle_group_id = table.Column<int>(type: "integer", nullable: false),
                    is_primary = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_exercise_muscles", x => new { x.exercise_id, x.muscle_group_id });
                    table.ForeignKey(
                        name: "fk_exercise_muscles_exercises_exercise_id",
                        column: x => x.exercise_id,
                        principalTable: "exercises",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_exercise_muscles_muscle_groups_muscle_group_id",
                        column: x => x.muscle_group_id,
                        principalTable: "muscle_groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "routine_exercises",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    exercise_id = table.Column<Guid>(type: "uuid", nullable: false),
                    routine_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false),
                    set_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_routine_exercises", x => x.id);
                    table.ForeignKey(
                        name: "fk_routine_exercises_exercises_exercise_id",
                        column: x => x.exercise_id,
                        principalTable: "exercises",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_routine_exercises_routines_routine_id",
                        column: x => x.routine_id,
                        principalTable: "routines",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "workout_exercises",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    exercise_id = table.Column<Guid>(type: "uuid", nullable: false),
                    workout_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workout_exercises", x => x.id);
                    table.ForeignKey(
                        name: "fk_workout_exercises_exercises_exercise_id",
                        column: x => x.exercise_id,
                        principalTable: "exercises",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_workout_exercises_workouts_workout_id",
                        column: x => x.workout_id,
                        principalTable: "workouts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "workout_sets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workout_exercise_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reps = table.Column<int>(type: "integer", nullable: true),
                    rpe = table.Column<decimal>(type: "numeric", nullable: true),
                    set_number = table.Column<int>(type: "integer", nullable: false),
                    weight_kg = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_workout_sets", x => x.id);
                    table.ForeignKey(
                        name: "fk_workout_sets_workout_exercises_workout_exercise_id",
                        column: x => x.workout_exercise_id,
                        principalTable: "workout_exercises",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "muscle_groups",
                columns: new[] { "id", "name", "slug" },
                values: new object[,]
                {
                    { 1, "Brust", "chest" },
                    { 2, "Rücken", "back" },
                    { 3, "Schultern", "shoulders" },
                    { 4, "Bizeps", "biceps" },
                    { 5, "Trizeps", "triceps" },
                    { 6, "Quadrizeps", "quadriceps" },
                    { 7, "Hamstrings", "hamstrings" },
                    { 8, "Glutes", "glutes" },
                    { 9, "Waden", "calves" },
                    { 10, "Bauch", "abs" },
                    { 11, "Unterarme", "forearms" }
                });

            migrationBuilder.CreateIndex(
                name: "ix_sleep_entries_user_id",
                table: "sleep_entries",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_exercise_muscles_muscle_group_id",
                table: "exercise_muscles",
                column: "muscle_group_id");

            migrationBuilder.CreateIndex(
                name: "ix_exercise_rest_preferences_exercise_id",
                table: "exercise_rest_preferences",
                column: "exercise_id");

            migrationBuilder.CreateIndex(
                name: "ix_exercises_user_id",
                table: "exercises",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_meal_entries_food_item_id",
                table: "meal_entries",
                column: "food_item_id");

            migrationBuilder.CreateIndex(
                name: "ix_meal_entries_user_id",
                table: "meal_entries",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_routine_exercises_exercise_id",
                table: "routine_exercises",
                column: "exercise_id");

            migrationBuilder.CreateIndex(
                name: "ix_routine_exercises_routine_id",
                table: "routine_exercises",
                column: "routine_id");

            migrationBuilder.CreateIndex(
                name: "ix_routines_user_id",
                table: "routines",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_workout_exercises_exercise_id",
                table: "workout_exercises",
                column: "exercise_id");

            migrationBuilder.CreateIndex(
                name: "ix_workout_exercises_workout_id",
                table: "workout_exercises",
                column: "workout_id");

            migrationBuilder.CreateIndex(
                name: "ix_workout_sets_workout_exercise_id",
                table: "workout_sets",
                column: "workout_exercise_id");

            migrationBuilder.CreateIndex(
                name: "ix_workouts_user_id",
                table: "workouts",
                column: "user_id");
        }
    }
}
