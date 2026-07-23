using NetArchTest.Rules;
using Store.Domain.Common;

namespace Store.ArchitectureTests;

public sealed class LayerDependencyTests
{
    [Fact]
    public void Domain_does_not_depend_on_outer_layers()
    {
        var result = Types.InAssembly(typeof(Entity).Assembly).ShouldNot().HaveDependencyOnAny("Store.Application", "Store.Infrastructure", "Store.Api").GetResult();
        Assert.True(result.IsSuccessful, Names(result));
    }

    [Fact]
    public void Application_does_not_depend_on_infrastructure_or_api()
    {
        var result = Types.InAssembly(typeof(Store.Application.Catalog.IProductCatalog).Assembly).ShouldNot().HaveDependencyOnAny("Store.Infrastructure", "Store.Api").GetResult();
        Assert.True(result.IsSuccessful, Names(result));
    }

    [Fact]
    public void Api_controllers_are_sealed()
    {
        var result = Types.InAssembly(typeof(Program).Assembly).That().ResideInNamespace("Store.Api.Controllers").And().HaveNameEndingWith("Controller").Should().BeSealed().GetResult();
        Assert.True(result.IsSuccessful, Names(result));
    }

    private static string Names(TestResult result) => result.FailingTypes is null ? string.Empty : string.Join(", ", result.FailingTypes.Select(x => x.FullName));
}
