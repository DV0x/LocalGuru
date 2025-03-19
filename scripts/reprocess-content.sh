#!/bin/bash
# Shell script to reprocess content for enhanced embeddings
set -e

# Default values
CONTENT_TYPE="all"
BATCH_SIZE=50
DELAY=10000
MAX_BATCHES=20
PRIORITY=5
SUBREDDIT=""
MIN_AGE=""
MAX_AGE=""
MONITOR=false
MONITOR_INTERVAL=30
MONITOR_DURATION=600
REPRESENTATION_TYPES="context_enhanced"

# Fixed connection details with URL-encoded password
DB_CONN="postgresql://postgres.ghjbtvyalvigvmuodaas:ch%40924880194792@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"

# Function to display usage
function show_usage {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -t, --type TYPE          Content type to process (all, posts, comments)"
  echo "  -b, --batch-size SIZE    Number of items per batch"
  echo "  -d, --delay MS           Milliseconds between batches"
  echo "  -m, --max-batches NUM    Maximum number of batches"
  echo "  -p, --priority NUM       Queue priority (1-10)"
  echo "  -s, --subreddit SUB      Filter by subreddit"
  echo "  --min-age HOURS          Minimum age in hours"
  echo "  --max-age HOURS          Maximum age in hours"
  echo "  --rep-types TYPES        Representation types (comma-separated: full,title,context_enhanced)"
  echo "  --monitor                Monitor progress after processing"
  echo "  --monitor-interval SEC   Monitoring check interval in seconds"
  echo "  --monitor-duration SEC   Maximum monitoring duration in seconds"
  echo "  --coverage               Show representation coverage stats before and after"
  echo "  -h, --help               Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 --type posts --batch-size 100 --subreddit travel"
  echo "  $0 --type all --monitor --rep-types context_enhanced"
  echo "  $0 --monitor-only --subreddit datascience"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--type)
      CONTENT_TYPE="$2"
      shift 2
      ;;
    -b|--batch-size)
      BATCH_SIZE="$2"
      shift 2
      ;;
    -d|--delay)
      DELAY="$2"
      shift 2
      ;;
    -m|--max-batches)
      MAX_BATCHES="$2"
      shift 2
      ;;
    -p|--priority)
      PRIORITY="$2"
      shift 2
      ;;
    -s|--subreddit)
      SUBREDDIT="$2"
      shift 2
      ;;
    --min-age)
      MIN_AGE="$2"
      shift 2
      ;;
    --max-age)
      MAX_AGE="$2"
      shift 2
      ;;
    --rep-types)
      REPRESENTATION_TYPES="$2"
      shift 2
      ;;
    --monitor)
      MONITOR=true
      shift
      ;;
    --monitor-interval)
      MONITOR_INTERVAL="$2"
      shift 2
      ;;
    --monitor-duration)
      MONITOR_DURATION="$2"
      shift 2
      ;;
    --monitor-only)
      MONITOR_ONLY=true
      shift
      ;;
    --coverage)
      SHOW_COVERAGE=true
      shift
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_usage
      exit 1
      ;;
  esac
done

# Copy .env.local to .env if it exists and .env doesn't
if [ -f ".env.local" ] && [ ! -f "scripts/.env" ]; then
  echo "Copying .env.local to scripts/.env for environment variables"
  cp .env.local scripts/.env
fi

# Navigate to scripts directory
cd "$(dirname "$0")"

# Function to run a SQL query
function run_sql_query() {
  query="$1"
  description="${2:-SQL Query}"
  
  echo "Running $description..."
  echo "$query" | psql "$DB_CONN" -t
}

# Direct SQL Function to reprocess content
function reprocess_batch() {
  local content_type="$1"
  local batch_size="$2"
  local subreddit_filter="$3"
  local min_age="$4"
  local max_age="$5"
  local rep_types="$6"
  
  # Build rep_types array string for SQL
  IFS=',' read -ra REP_ARRAY <<< "$rep_types"
  rep_types_sql="ARRAY["
  for i in "${!REP_ARRAY[@]}"; do
    if [ $i -gt 0 ]; then
      rep_types_sql+=", "
    fi
    rep_types_sql+="'${REP_ARRAY[$i]}'"
  done
  rep_types_sql+="]"
  
  # Create SQL for subreddit filter
  if [ -n "$subreddit_filter" ]; then
    subreddit_sql="'$subreddit_filter'"
  else
    subreddit_sql="NULL"
  fi
  
  # Create SQL for age filters
  if [ -n "$min_age" ]; then
    min_age_sql="$min_age"
  else
    min_age_sql="NULL"
  fi
  
  if [ -n "$max_age" ]; then
    max_age_sql="$max_age"
  else
    max_age_sql="NULL"
  fi
  
  # Build and execute query
  query="SELECT * FROM refresh_content_representations('$content_type', $batch_size, $subreddit_sql, $min_age_sql, $max_age_sql, $rep_types_sql);"
  run_sql_query "$query" "Reprocessing batch of $content_type"
}

# Show coverage if requested
if [ "$SHOW_COVERAGE" = true ]; then
  COVERAGE_QUERY="SELECT * FROM get_representation_coverage();"
  run_sql_query "$COVERAGE_QUERY" "Initial representation coverage"
fi

# Check if we're just monitoring
if [ "$MONITOR_ONLY" = true ]; then
  echo "Running monitoring only..."
  MONITOR_QUERY="SELECT * FROM get_content_representation_status();"
  
  # Simple monitoring loop
  echo "Monitoring content representation status..."
  echo "Press Ctrl+C to stop monitoring."
  
  for ((i=1; i<=$MONITOR_DURATION/$MONITOR_INTERVAL; i++)); do
    echo -e "\nMonitoring iteration $i ($(date)):"
    run_sql_query "$MONITOR_QUERY" "Content representation status"
    echo "Waiting $MONITOR_INTERVAL seconds for next check..."
    sleep $MONITOR_INTERVAL
  done
  
  exit 0
fi

# Process batches
echo "Starting content reprocessing..."
for ((i=1; i<=$MAX_BATCHES; i++)); do
  echo "Processing batch $i of $MAX_BATCHES..."
  reprocess_batch "$CONTENT_TYPE" "$BATCH_SIZE" "$SUBREDDIT" "$MIN_AGE" "$MAX_AGE" "$REPRESENTATION_TYPES"
  
  if [ $i -lt $MAX_BATCHES ]; then
    echo "Waiting $((DELAY/1000)) seconds before next batch..."
    sleep $((DELAY/1000))
  fi
done

# Monitor if requested
if [ "$MONITOR" = true ]; then
  echo "Starting monitoring..."
  MONITOR_QUERY="SELECT * FROM get_content_representation_status();"
  
  # Simple monitoring loop
  echo "Monitoring content representation status..."
  echo "Press Ctrl+C to stop monitoring."
  
  for ((i=1; i<=$MONITOR_DURATION/$MONITOR_INTERVAL; i++)); do
    echo -e "\nMonitoring iteration $i ($(date)):"
    run_sql_query "$MONITOR_QUERY" "Content representation status"
    echo "Waiting $MONITOR_INTERVAL seconds for next check..."
    sleep $MONITOR_INTERVAL
  done
fi

# Show coverage after processing if requested
if [ "$SHOW_COVERAGE" = true ]; then
  COVERAGE_QUERY="SELECT * FROM get_representation_coverage();"
  run_sql_query "$COVERAGE_QUERY" "Final representation coverage"
fi

echo "All done!" 