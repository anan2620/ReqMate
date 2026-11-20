window.BENCHMARK_DATA = {
  "lastUpdate": 1795159850455,
  "repoUrl": "https://github.com/anan2620/ReqMate",
  "entries": {
    "ReqMate Benchmarks": [
      {
        "commit": {
          "author": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "committer": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "distinct": true,
          "id": "99190aa9217af9c8f282594729743b6486e3a8f4",
          "message": "ci(benchmarks): allow manual re-run via workflow_dispatch\n\nbenchmark-action 需要 gh-pages 分支存在，之前仓库没有该分支导致\n'couldn't find remote ref gh-pages' 直接失败；分支已单独创建。\n这里补上 workflow_dispatch，失败后可直接重跑而不用空推提交。",
          "timestamp": "2026-11-18T12:48:29+08:00",
          "tree_id": "ebfb218de743fd1675808170975aafbf7ebff779",
          "url": "https://github.com/anan2620/ReqMate/commit/99190aa9217af9c8f282594729743b6486e3a8f4"
        },
        "date": 1794978960393,
        "tool": "cargo",
        "benches": [
          {
            "name": "assertions/single_status_eq",
            "value": 724,
            "range": "± 8",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/response_time_lt",
            "value": 795,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/nested_body_path",
            "value": 3914,
            "range": "± 12",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/array_index_access",
            "value": 3639,
            "range": "± 150",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/regex_match",
            "value": 114719,
            "range": "± 423",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/5",
            "value": 16257,
            "range": "± 58",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/10",
            "value": 32653,
            "range": "± 85",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/20",
            "value": 64690,
            "range": "± 155",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/100",
            "value": 1403254,
            "range": "± 1739",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/500",
            "value": 7020695,
            "range": "± 14418",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/1000",
            "value": 14203484,
            "range": "± 19718",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/single_yaml_parse",
            "value": 14166,
            "range": "± 39",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/complex_yaml_parse",
            "value": 35573,
            "range": "± 73",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/simple_get",
            "value": 186,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/post_with_json",
            "value": 780,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/complex_with_auth_headers",
            "value": 2931,
            "range": "± 6",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/many_headers_10",
            "value": 2355,
            "range": "± 13",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/simple_1var",
            "value": 290,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/medium_5vars",
            "value": 989,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/heavy_50vars",
            "value": 8438,
            "range": "± 22",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/no_vars_passthrough",
            "value": 71,
            "range": "± 0",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_uuid",
            "value": 602,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_timestamp",
            "value": 290,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_randomString",
            "value": 340,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/5",
            "value": 1754,
            "range": "± 7",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/20",
            "value": 8239,
            "range": "± 24",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/50",
            "value": 20347,
            "range": "± 46",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/empty_script_overhead",
            "value": 699284,
            "range": "± 5089",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_single",
            "value": 719668,
            "range": "± 2426",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_10_vars",
            "value": 747521,
            "range": "± 3253",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/single_test_assertion",
            "value": 768312,
            "range": "± 1499",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/multiple_tests_with_json",
            "value": 862382,
            "range": "± 1615",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/modify_request",
            "value": 732845,
            "range": "± 1524",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "committer": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "distinct": true,
          "id": "68b67c5535b3e62978148903f7c448d6672fa487",
          "message": "ci(benchmarks): clear stale criterion cache",
          "timestamp": "2026-11-18T17:08:03+08:00",
          "tree_id": "11821eb6ab816580dcc699517efef9702706925d",
          "url": "https://github.com/anan2620/ReqMate/commit/68b67c5535b3e62978148903f7c448d6672fa487"
        },
        "date": 1794993597430,
        "tool": "cargo",
        "benches": [
          {
            "name": "assertions/single_status_eq",
            "value": 1114,
            "range": "± 9",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/response_time_lt",
            "value": 1080,
            "range": "± 59",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/nested_body_path",
            "value": 4842,
            "range": "± 27",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/array_index_access",
            "value": 4540,
            "range": "± 58",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/regex_match",
            "value": 147423,
            "range": "± 747",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/5",
            "value": 16715,
            "range": "± 49",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/10",
            "value": 37954,
            "range": "± 308",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/20",
            "value": 67156,
            "range": "± 562",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/100",
            "value": 2374365,
            "range": "± 13735",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/500",
            "value": 11686222,
            "range": "± 33522",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/1000",
            "value": 23758741,
            "range": "± 149687",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/single_yaml_parse",
            "value": 23667,
            "range": "± 244",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/complex_yaml_parse",
            "value": 54205,
            "range": "± 821",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/simple_get",
            "value": 275,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/post_with_json",
            "value": 1034,
            "range": "± 6",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/complex_with_auth_headers",
            "value": 3976,
            "range": "± 28",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/many_headers_10",
            "value": 3027,
            "range": "± 48",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/simple_1var",
            "value": 463,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/medium_5vars",
            "value": 1523,
            "range": "± 46",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/heavy_50vars",
            "value": 13707,
            "range": "± 128",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/no_vars_passthrough",
            "value": 106,
            "range": "± 0",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_uuid",
            "value": 1009,
            "range": "± 8",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_timestamp",
            "value": 430,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_randomString",
            "value": 497,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/5",
            "value": 2833,
            "range": "± 88",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/20",
            "value": 12348,
            "range": "± 71",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/50",
            "value": 30402,
            "range": "± 956",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/empty_script_overhead",
            "value": 949299,
            "range": "± 21983",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_single",
            "value": 961979,
            "range": "± 9472",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_10_vars",
            "value": 995423,
            "range": "± 21782",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/single_test_assertion",
            "value": 1028957,
            "range": "± 91341",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/multiple_tests_with_json",
            "value": 1158680,
            "range": "± 26902",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/modify_request",
            "value": 979801,
            "range": "± 5792",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "committer": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "distinct": true,
          "id": "79659c40f4d72f4a3a4e0e25efc03dcf3c84869a",
          "message": "chore(gitignore): 清理误提交的 cargo 缓存目录残留\n\n- 删除 src-tauri/targetCjiXdY/CACHEDIR.TAG（cargo 缓存目录标记，无实际产物）\n- 忽略规则改为 apps/desktop/src-tauri/target*/ 以覆盖带随机后缀的临时 target 目录",
          "timestamp": "2026-11-19T09:19:24+08:00",
          "tree_id": "acc530c1c925be2e0324fe0831e7111b17b78147",
          "url": "https://github.com/anan2620/ReqMate/commit/79659c40f4d72f4a3a4e0e25efc03dcf3c84869a"
        },
        "date": 1795051843082,
        "tool": "cargo",
        "benches": [
          {
            "name": "assertions/single_status_eq",
            "value": 886,
            "range": "± 13",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/response_time_lt",
            "value": 872,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/nested_body_path",
            "value": 3790,
            "range": "± 66",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/array_index_access",
            "value": 3603,
            "range": "± 34",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/regex_match",
            "value": 124269,
            "range": "± 1602",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/5",
            "value": 13742,
            "range": "± 53",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/10",
            "value": 33444,
            "range": "± 598",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/20",
            "value": 62981,
            "range": "± 437",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/100",
            "value": 1888045,
            "range": "± 8500",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/500",
            "value": 9452183,
            "range": "± 169433",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/1000",
            "value": 19196416,
            "range": "± 60793",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/single_yaml_parse",
            "value": 18695,
            "range": "± 60",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/complex_yaml_parse",
            "value": 41937,
            "range": "± 221",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/simple_get",
            "value": 223,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/post_with_json",
            "value": 847,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/complex_with_auth_headers",
            "value": 3061,
            "range": "± 118",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/many_headers_10",
            "value": 2226,
            "range": "± 39",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/simple_1var",
            "value": 369,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/medium_5vars",
            "value": 1252,
            "range": "± 7",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/heavy_50vars",
            "value": 11701,
            "range": "± 157",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/no_vars_passthrough",
            "value": 84,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_uuid",
            "value": 942,
            "range": "± 9",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_timestamp",
            "value": 362,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_randomString",
            "value": 419,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/5",
            "value": 2266,
            "range": "± 11",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/20",
            "value": 9540,
            "range": "± 58",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/50",
            "value": 23926,
            "range": "± 213",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/empty_script_overhead",
            "value": 677576,
            "range": "± 7550",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_single",
            "value": 693069,
            "range": "± 9883",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_10_vars",
            "value": 720765,
            "range": "± 11313",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/single_test_assertion",
            "value": 741304,
            "range": "± 4655",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/multiple_tests_with_json",
            "value": 839208,
            "range": "± 11867",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/modify_request",
            "value": 706930,
            "range": "± 3369",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "committer": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "distinct": true,
          "id": "364e8d42d2cd0bb2d9cb6b5eb424136a5f10a917",
          "message": "feat(desktop): 抓包解不了的站点自动降级，并支持一键信任 CA\n\n中间人转发已经能返回真实响应；这次保证「解不了也不能把请求弄断」。\n\n- ProxyState 增加 tunnel_only 集合：TLS 握手失败（客户端证书固定、CA 未受信任）\n  或上游返回 101（wss 等无法代理的升级）时记住该 host，此后同一站点直接走\n  盲隧道，请求照常收发，抓包里写明降级原因；集合随代理启动重建\n- 新增 proxy_trust_ca 命令：macOS 经 osascript 调 security add-trusted-cert\n  写入系统信任库（弹出系统密码框），Windows 用 certutil 写入当前用户证书库，\n  Linux 返回手动导入步骤\n- 面板 CA 卡片新增「安装并信任」按钮，成功后自动重启代理，顺带清空降级名单；\n  运行中未解密时显示「HTTPS 未解密：生成并信任 CA 后可看到正文」\n- 新增 i18n proxy.mitmOff / trustCa / trusted，9 个语言包各 760 键一致\n- 测试：握手失败后同 host 第二次连接走隧道且能正常回显（cargo test 182 passed）",
          "timestamp": "2026-11-19T16:44:14+08:00",
          "tree_id": "7ad7e344b96db34a14e88bf2fbdfbe41b591c9b0",
          "url": "https://github.com/anan2620/ReqMate/commit/364e8d42d2cd0bb2d9cb6b5eb424136a5f10a917"
        },
        "date": 1795078565311,
        "tool": "cargo",
        "benches": [
          {
            "name": "assertions/single_status_eq",
            "value": 828,
            "range": "± 17",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/response_time_lt",
            "value": 953,
            "range": "± 18",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/nested_body_path",
            "value": 4737,
            "range": "± 101",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/array_index_access",
            "value": 4416,
            "range": "± 73",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/regex_match",
            "value": 134036,
            "range": "± 2686",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/5",
            "value": 19259,
            "range": "± 336",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/10",
            "value": 38971,
            "range": "± 716",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/20",
            "value": 73143,
            "range": "± 1535",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/100",
            "value": 1685045,
            "range": "± 18236",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/500",
            "value": 8392520,
            "range": "± 56355",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/1000",
            "value": 17041533,
            "range": "± 90120",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/single_yaml_parse",
            "value": 17218,
            "range": "± 354",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/complex_yaml_parse",
            "value": 43252,
            "range": "± 734",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/simple_get",
            "value": 214,
            "range": "± 4",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/post_with_json",
            "value": 955,
            "range": "± 19",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/complex_with_auth_headers",
            "value": 3694,
            "range": "± 80",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/many_headers_10",
            "value": 2791,
            "range": "± 49",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/simple_1var",
            "value": 333,
            "range": "± 6",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/medium_5vars",
            "value": 1093,
            "range": "± 28",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/heavy_50vars",
            "value": 9864,
            "range": "± 183",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/no_vars_passthrough",
            "value": 83,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_uuid",
            "value": 699,
            "range": "± 15",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_timestamp",
            "value": 325,
            "range": "± 8",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_randomString",
            "value": 378,
            "range": "± 11",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/5",
            "value": 2091,
            "range": "± 45",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/20",
            "value": 9580,
            "range": "± 280",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/50",
            "value": 23822,
            "range": "± 439",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/empty_script_overhead",
            "value": 863852,
            "range": "± 21284",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_single",
            "value": 891873,
            "range": "± 12543",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_10_vars",
            "value": 919056,
            "range": "± 22479",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/single_test_assertion",
            "value": 948099,
            "range": "± 13563",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/multiple_tests_with_json",
            "value": 1055861,
            "range": "± 20091",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/modify_request",
            "value": 902379,
            "range": "± 13836",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "committer": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "distinct": true,
          "id": "695a51b877993893250276d63143de291f5f4462",
          "message": "feat(desktop): suggest common keys while editing request headers\n\nThe header key field is now a combobox: it offers presets but still takes\nany custom header.\n\n- `Combobox` (input + Radix Popover): the list is portalled so it is not\n  clipped by the scrolling editor panel, filtering is case-insensitive\n  with prefix matches first, and picking works with the mouse, arrow keys\n  + Enter, or Escape to dismiss\n- `COMMON_REQUEST_HEADERS`: Authorization, Cookie, Content-Type,\n  Content-Range, Content-Encoding and Content-Length, plus other common\n  request headers\n- wired into the HTTP, WebSocket, SSE, Socket.IO and GraphQL header\n  editors; query and body rows keep the plain input\n- tests for the filter ordering and for the combobox interactions",
          "timestamp": "2026-11-20T15:01:43+08:00",
          "tree_id": "eb2af8e3d8d398a03cb12e1bbd79f1cf7b0caf06",
          "url": "https://github.com/anan2620/ReqMate/commit/695a51b877993893250276d63143de291f5f4462"
        },
        "date": 1795158882503,
        "tool": "cargo",
        "benches": [
          {
            "name": "assertions/single_status_eq",
            "value": 690,
            "range": "± 50",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/response_time_lt",
            "value": 724,
            "range": "± 51",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/nested_body_path",
            "value": 3292,
            "range": "± 120",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/array_index_access",
            "value": 3095,
            "range": "± 79",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/regex_match",
            "value": 81327,
            "range": "± 1491",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/5",
            "value": 11614,
            "range": "± 251",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/10",
            "value": 28171,
            "range": "± 2730",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/20",
            "value": 54964,
            "range": "± 1697",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/100",
            "value": 1430098,
            "range": "± 26530",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/500",
            "value": 7160290,
            "range": "± 710706",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/1000",
            "value": 14691911,
            "range": "± 570299",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/single_yaml_parse",
            "value": 13534,
            "range": "± 300",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/complex_yaml_parse",
            "value": 29185,
            "range": "± 559",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/simple_get",
            "value": 154,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/post_with_json",
            "value": 632,
            "range": "± 16",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/complex_with_auth_headers",
            "value": 2518,
            "range": "± 42",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/many_headers_10",
            "value": 2015,
            "range": "± 16",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/simple_1var",
            "value": 248,
            "range": "± 7",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/medium_5vars",
            "value": 861,
            "range": "± 14",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/heavy_50vars",
            "value": 7894,
            "range": "± 140",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/no_vars_passthrough",
            "value": 64,
            "range": "± 0",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_uuid",
            "value": 694,
            "range": "± 9",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_timestamp",
            "value": 268,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_randomString",
            "value": 301,
            "range": "± 5",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/5",
            "value": 1698,
            "range": "± 43",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/20",
            "value": 7680,
            "range": "± 168",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/50",
            "value": 18405,
            "range": "± 507",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/empty_script_overhead",
            "value": 511813,
            "range": "± 17961",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_single",
            "value": 519951,
            "range": "± 7147",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_10_vars",
            "value": 527247,
            "range": "± 10465",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/single_test_assertion",
            "value": 527517,
            "range": "± 10301",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/multiple_tests_with_json",
            "value": 611916,
            "range": "± 47778",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/modify_request",
            "value": 515973,
            "range": "± 42657",
            "unit": "ns/iter"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "committer": {
            "email": "aya@webside.de5.net",
            "name": "hua"
          },
          "distinct": true,
          "id": "9b13bffef4a38b88934bc77c6cd30387778b6028",
          "message": "chore(release): bump to v1.1.4\n\nPatch release for the monitor-creation crash (SIGABRT) and the request\nheader key suggestions.\n\nAll 14 manifests are on 1.1.4; `check:versions`, `check:models` and\n`cargo metadata --locked` for the three crates are green.",
          "timestamp": "2026-11-20T15:15:24+08:00",
          "tree_id": "1f52bb6edbbf0319dcd959a749b103b185893949",
          "url": "https://github.com/anan2620/ReqMate/commit/9b13bffef4a38b88934bc77c6cd30387778b6028"
        },
        "date": 1795159849680,
        "tool": "cargo",
        "benches": [
          {
            "name": "assertions/single_status_eq",
            "value": 730,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/response_time_lt",
            "value": 795,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/nested_body_path",
            "value": 3903,
            "range": "± 200",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/array_index_access",
            "value": 3652,
            "range": "± 8",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/regex_match",
            "value": 110778,
            "range": "± 166",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/5",
            "value": 15894,
            "range": "± 30",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/10",
            "value": 31360,
            "range": "± 91",
            "unit": "ns/iter"
          },
          {
            "name": "assertions/multiple_assertions/20",
            "value": 64458,
            "range": "± 136",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/100",
            "value": 1405211,
            "range": "± 5737",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/500",
            "value": 7019054,
            "range": "± 17377",
            "unit": "ns/iter"
          },
          {
            "name": "collection_loading/load_tree/1000",
            "value": 14185542,
            "range": "± 23874",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/single_yaml_parse",
            "value": 14310,
            "range": "± 36",
            "unit": "ns/iter"
          },
          {
            "name": "read_request/complex_yaml_parse",
            "value": 35658,
            "range": "± 70",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/simple_get",
            "value": 208,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/post_with_json",
            "value": 849,
            "range": "± 2",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/complex_with_auth_headers",
            "value": 3188,
            "range": "± 29",
            "unit": "ns/iter"
          },
          {
            "name": "curl_parsing/many_headers_10",
            "value": 2511,
            "range": "± 9",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/simple_1var",
            "value": 295,
            "range": "± 0",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/medium_5vars",
            "value": 973,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/heavy_50vars",
            "value": 8369,
            "range": "± 17",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/no_vars_passthrough",
            "value": 71,
            "range": "± 0",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_uuid",
            "value": 598,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_timestamp",
            "value": 288,
            "range": "± 0",
            "unit": "ns/iter"
          },
          {
            "name": "interpolation/dynamic_randomString",
            "value": 332,
            "range": "± 1",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/5",
            "value": 1781,
            "range": "± 3",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/20",
            "value": 8159,
            "range": "± 11",
            "unit": "ns/iter"
          },
          {
            "name": "interpolate_map/headers/50",
            "value": 20060,
            "range": "± 89",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/empty_script_overhead",
            "value": 696560,
            "range": "± 1426",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_single",
            "value": 717376,
            "range": "± 2075",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/env_set_10_vars",
            "value": 742365,
            "range": "± 1717",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/single_test_assertion",
            "value": 766289,
            "range": "± 1112",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/multiple_tests_with_json",
            "value": 859015,
            "range": "± 1976",
            "unit": "ns/iter"
          },
          {
            "name": "scripting/modify_request",
            "value": 729924,
            "range": "± 3775",
            "unit": "ns/iter"
          }
        ]
      }
    ]
  }
}