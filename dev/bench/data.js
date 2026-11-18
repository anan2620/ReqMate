window.BENCHMARK_DATA = {
  "lastUpdate": 1794978960657,
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
      }
    ]
  }
}