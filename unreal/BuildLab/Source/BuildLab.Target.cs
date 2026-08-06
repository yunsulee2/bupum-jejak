using UnrealBuildTool;
using System.Collections.Generic;

public class BuildLabTarget : TargetRules
{
    public BuildLabTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        ExtraModuleNames.Add("BuildLab");
    }
}
