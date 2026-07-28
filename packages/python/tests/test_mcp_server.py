"""Smoke tests for the machine-readable MCP tool interface."""

import asyncio

from e2p.mcp_server import mcp


def _tools_by_name():
    return {
        tool.name: tool
        for tool in asyncio.run(mcp.list_tools())
    }


def _parameter_enum(tool, parameter):
    return set(
        tool.inputSchema["properties"][parameter]["enum"]
    )


def test_mcp_exposes_the_documented_tools():
    assert set(_tools_by_name()) == {
        "parametric_binary",
        "parametric_continuous",
        "convert_effect_size",
        "compute_roc_auc",
        "compute_pr_auc",
        "find_threshold",
        "apply_reliability_attenuation",
    }


def test_mcp_schema_exposes_valid_choice_parameters():
    tools = _tools_by_name()
    views = {"true", "observed"}
    effect_types = {"d", "auc", "or", "log_or", "u3", "r"}

    assert _parameter_enum(
        tools["parametric_binary"],
        "view",
    ) == views
    assert _parameter_enum(
        tools["parametric_continuous"],
        "view",
    ) == views
    assert _parameter_enum(
        tools["convert_effect_size"],
        "from_type",
    ) == effect_types
    assert _parameter_enum(
        tools["convert_effect_size"],
        "to_type",
    ) == effect_types
    assert _parameter_enum(
        tools["find_threshold"],
        "metric",
    ) == {"youden", "f1"}
