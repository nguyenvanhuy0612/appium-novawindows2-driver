# Lab info
Client IP: 172.16.10.37
Login: admin
Password: admin
SSH server

# Test Environment
Appium server: 172.16.10.37:4723
Script to build and deploy: ./scripts/mac/build_deploy_restart.sh
Python: conda activate py313

# Issue description
1. Cannot get attribute `Value.Value` of element `//Window[@Name='SecureAge - Address Book']//ComboBox`
2. Check and fix get all attributes of element
3. The inspect.exe dump for this locator is tests/inspect_dump.txt, use as reference
4. Run test at conda run py313 .tests/test_legacy_att.py