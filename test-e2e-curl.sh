#!/bin/bash

# ERP System E2E Tests with curl
# Converted from Playwright tests for faster execution and debugging

set -e

# Configuration
BASE_URL="http://0.0.0.0:3000/api/v1"
TEMP_DIR="/tmp/erp-e2e-test"
COOKIE_JAR="$TEMP_DIR/cookies.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Setup
setup_tests() {
    echo -e "${BLUE}🧪 Setting up E2E tests...${NC}"
    mkdir -p "$TEMP_DIR"
    > "$COOKIE_JAR"

    # Test server connectivity
    echo -e "${BLUE}🔍 Testing server connectivity...${NC}"
    if curl -s -f "$BASE_URL/docs" > /dev/null; then
        echo -e "${GREEN}✅ Server is responding${NC}"
    else
        echo -e "${RED}❌ Server is not responding at $BASE_URL${NC}"
        exit 1
    fi
}

# Test helpers
assert_success() {
    local response="$1"
    local test_name="$2"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        echo -e "${RED}   Response: $response${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

assert_status() {
    local expected_status="$1"
    local actual_status="$2"
    local test_name="$3"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    if [ "$expected_status" = "$actual_status" ]; then
        echo -e "${GREEN}✅ PASS: $test_name (Status $actual_status)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL: $test_name (Expected $expected_status, got $actual_status)${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Cleanup
cleanup_tests() {
    echo -e "${BLUE}🧹 Cleaning up...${NC}"
    rm -rf "$TEMP_DIR"
}

# Test Results Summary
show_results() {
    echo -e "\n${BLUE}📊 Test Results Summary:${NC}"
    echo -e "   Total Tests: $TESTS_TOTAL"
    echo -e "${GREEN}   Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}   Failed: $TESTS_FAILED${NC}"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed!${NC}"
        return 0
    else
        echo -e "\n${RED}💥 Some tests failed!${NC}"
        return 1
    fi
}

# User Management Tests
test_user_management() {
    echo -e "\n${YELLOW}👥 Testing User Management Flows...${NC}"

    # Test 1: Admin creates new user successfully
    echo -e "\n${BLUE}Test 1: Admin creates new user${NC}"

    # Create admin user first
    admin_response=$(curl -s -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "admin@company.com",
            "username": "admin",
            "firstName": "Admin",
            "lastName": "User",
            "password": "SecureP@ss123!",
            "role": "ADMIN"
        }' || echo "HTTP_ERROR")

    # Wait a moment for user creation
    sleep 0.5

    # Create new user
    new_user_response=$(curl -s -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "new.employee@company.com",
            "username": "newemployee",
            "firstName": "New",
            "lastName": "Employee",
            "password": "SecureP@ss123!",
            "role": "USER"
        }' || echo "HTTP_ERROR")

    assert_success "$new_user_response" "Admin creates new user"

    # Test 2: Admin lists users with pagination
    echo -e "\n${BLUE}Test 2: Admin lists users with pagination${NC}"

    # Create additional users for pagination test (avoid conflicts with existing users)
    local created_count=0
    local timestamp=$(date +%s)
    for i in {1..3}; do
        create_response=$(curl -s -X POST "$BASE_URL/users" \
            -H "Content-Type: application/json" \
            -d "{
                \"email\": \"pagination.user$i.$timestamp@company.com\",
                \"username\": \"paginationuser$i$timestamp\",
                \"firstName\": \"Pagination$i\",
                \"lastName\": \"Test$i\",
                \"password\": \"SecureP@ss123!\",
                \"role\": \"USER\"
            }" || echo "HTTP_ERROR")

        if echo "$create_response" | grep -q '"success":true'; then
            created_count=$((created_count + 1))
        fi
    done

    echo -e "${BLUE}   Created $created_count additional users for pagination test${NC}"

    sleep 1  # Wait for user creation

    # Get users list with pagination (using skip/take instead of page/limit)
    users_list_response=$(curl -s -X GET "$BASE_URL/users?skip=0&take=3" || echo "HTTP_ERROR")

    if echo "$users_list_response" | grep -q '"success":true' && echo "$users_list_response" | grep -q '"users"'; then
        # Count users by counting the "id":" pattern in the response
        user_count=$(echo "$users_list_response" | grep -o '"id":"' | wc -l)
        # We expect at least 2 users (admin from test 1 + at least 1 new user)
        if [ "$user_count" -ge 2 ]; then
            echo -e "${GREEN}✅ PASS: Admin lists users with pagination ($user_count users returned, expected >=2)${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}❌ FAIL: Admin lists users with pagination (Expected >=2 users, got $user_count)${NC}"
            echo -e "${RED}   Response sample: $(echo "$users_list_response" | cut -c1-200)${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
        TESTS_TOTAL=$((TESTS_TOTAL + 1))
    else
        echo -e "${RED}❌ FAIL: Admin lists users with pagination${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TESTS_TOTAL=$((TESTS_TOTAL + 1))
    fi

    # Test 3: Admin updates user information
    echo -e "\n${BLUE}Test 3: Admin updates user information${NC}"

    # Create a user for update test
    update_user_response=$(curl -s -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "update.test@company.com",
            "username": "updatetest",
            "firstName": "Original",
            "lastName": "Name",
            "password": "SecureP@ss123!",
            "role": "USER"
        }' || echo "HTTP_ERROR")

    user_id=$(echo "$update_user_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$user_id" ]; then
        # Update the user
        updated_response=$(curl -s -X PUT "$BASE_URL/users/$user_id" \
            -H "Content-Type: application/json" \
            -d '{
                "firstName": "Updated",
                "lastName": "Name"
            }' || echo "HTTP_ERROR")

        if echo "$updated_response" | grep -q '"firstName":"Updated"' && echo "$updated_response" | grep -q '"lastName":"Name"'; then
            echo -e "${GREEN}✅ PASS: Admin updates user information${NC}"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            echo -e "${RED}❌ FAIL: Admin updates user information${NC}"
            echo -e "${RED}   Response: $updated_response${NC}"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
        TESTS_TOTAL=$((TESTS_TOTAL + 1))
    else
        echo -e "${RED}❌ FAIL: Admin updates user information (Could not create user)${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TESTS_TOTAL=$((TESTS_TOTAL + 1))
    fi

    # Test 4: Search users by name
    echo -e "\n${BLUE}Test 4: Search users by name${NC}"

    # Create a user with searchable name
    curl -s -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "john.doe@company.com",
            "username": "johndoe",
            "firstName": "John",
            "lastName": "Doe",
            "password": "SecureP@ss123!",
            "role": "USER"
        }' > /dev/null

    sleep 0.5

    # Search for "John"
    search_response=$(curl -s -X GET "$BASE_URL/users?search=John" || echo "HTTP_ERROR")

    if echo "$search_response" | grep -q '"success":true' && echo "$search_response" | grep -q '"firstName":"John"'; then
        echo -e "${GREEN}✅ PASS: Search users by name${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL: Search users by name${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    # Test 5: Filter users by role
    echo -e "\n${BLUE}Test 5: Filter users by role${NC}"

    # Create a manager user
    curl -s -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "manager.filter@company.com",
            "username": "managerfilter",
            "firstName": "Manager",
            "lastName": "Filter",
            "password": "SecureP@ss123!",
            "role": "MANAGER"
        }' > /dev/null

    sleep 0.5

    # Filter by MANAGER role
    role_filter_response=$(curl -s -X GET "$BASE_URL/users?role=MANAGER" || echo "HTTP_ERROR")

    if echo "$role_filter_response" | grep -q '"success":true' && echo "$role_filter_response" | grep -q '"role":"MANAGER"'; then
        echo -e "${GREEN}✅ PASS: Filter users by role${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL: Filter users by role${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

# Security Tests
test_user_security() {
    echo -e "\n${YELLOW}🔒 Testing User Security Scenarios...${NC}"

    # Test 1: Rejects weak password during user creation
    echo -e "\n${BLUE}Test 1: Rejects weak password${NC}"

    weak_password_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "weak.password@company.com",
            "username": "weakpassword",
            "firstName": "Weak",
            "lastName": "Password",
            "password": "123",
            "role": "USER"
        }')

    # Extract status code (last 3 characters)
    status_code="${weak_password_response: -3}"
    response_body="${weak_password_response%???}"

    assert_status "400" "$status_code" "Rejects weak password"

    # Test 2: Sanitizes malicious input
    echo -e "\n${BLUE}Test 2: Sanitizes malicious input${NC}"

    malicious_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "malicious@company.com",
            "username": "malicious",
            "firstName": "<script>alert(\"xss\")</script>",
            "lastName": "Doe",
            "password": "SecureP@ss123!",
            "role": "USER"
        }')

    status_code="${malicious_response: -3}"
    response_body="${malicious_response%???}"

    assert_status "400" "$status_code" "Sanitizes malicious input"

    # Test 3: Prevents duplicate user creation
    echo -e "\n${BLUE}Test 3: Prevents duplicate user creation${NC}"

    # Create first user
    curl -s -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "duplicate@company.com",
            "username": "duplicate",
            "firstName": "First",
            "lastName": "User",
            "password": "SecureP@ss123!",
            "role": "USER"
        }' > /dev/null

    sleep 0.5

    # Try to create duplicate
    duplicate_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "duplicate@company.com",
            "username": "duplicate",
            "firstName": "Second",
            "lastName": "User",
            "password": "SecureP@ss123!",
            "role": "USER"
        }')

    status_code="${duplicate_response: -3}"

    assert_status "409" "$status_code" "Prevents duplicate user creation"

    # Test 4: Validates required fields
    echo -e "\n${BLUE}Test 4: Validates required fields${NC}"

    required_fields_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "incomplete@company.com"
        }')

    status_code="${required_fields_response: -3}"

    assert_status "400" "$status_code" "Validates required fields"

    # Test 5: Enforces email format validation
    echo -e "\n${BLUE}Test 5: Enforces email format validation${NC}"

    invalid_email_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "invalid-email",
            "username": "invalidemail",
            "firstName": "Invalid",
            "lastName": "Email",
            "password": "SecureP@ss123!",
            "role": "USER"
        }')

    status_code="${invalid_email_response: -3}"

    assert_status "400" "$status_code" "Enforces email format validation"

    # Test 6: Enforces username length and format
    echo -e "\n${BLUE}Test 6: Enforces username length and format${NC}"

    short_username_response=$(curl -s -w "%{http_code}" -X POST "$BASE_URL/users" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "shortusername@company.com",
            "username": "ab",
            "firstName": "Short",
            "lastName": "Username",
            "password": "SecureP@ss123!",
            "role": "USER"
        }')

    status_code="${short_username_response: -3}"

    assert_status "400" "$status_code" "Enforces username length and format"
}

# API Health Check
test_api_health() {
    echo -e "\n${YELLOW}🏥 Testing API Health...${NC}"

    # Test API docs endpoint
    docs_response=$(curl -s -w "%{http_code}" "$BASE_URL/docs")
    status_code="${docs_response: -3}"

    assert_status "200" "$status_code" "API Documentation endpoint"

    # Test users endpoint exists
    users_endpoint_response=$(curl -s -w "%{http_code}" -X GET "$BASE_URL/users")
    status_code="${users_endpoint_response: -3}"

    if [ "$status_code" != "404" ]; then
        echo -e "${GREEN}✅ PASS: Users endpoint exists (Status $status_code)${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL: Users endpoint not found (Status 404)${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Starting ERP System E2E Tests with curl${NC}"
    echo -e "${BLUE}📍 Testing against: $BASE_URL${NC}"

    # Set up trap for cleanup
    trap cleanup_tests EXIT

    setup_tests

    # Run all test suites
    test_api_health
    test_user_management
    test_user_security

    # Show final results
    show_results
}

# Run tests if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi